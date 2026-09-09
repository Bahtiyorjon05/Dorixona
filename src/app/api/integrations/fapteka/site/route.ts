import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decodeXmlBuffer, parseFaptekaXml } from "@/lib/integrations/fapteka/client";
import { syncFaptekaSiteRows } from "@/lib/integrations/fapteka/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function tokenFromRequest(request: NextRequest) {
  const auth = request.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return (
    bearer ||
    request.headers.get("x-fapteka-token")?.trim() ||
    request.headers.get("token")?.trim() ||
    request.nextUrl.searchParams.get("token")?.trim() ||
    request.nextUrl.searchParams.get("TOCING")?.trim() ||
    request.nextUrl.searchParams.get("tocing")?.trim() ||
    ""
  );
}

function stripBom(text: string) {
  return text.replace(/^[\uFEFF\uFFFE\u0000]+/, "");
}

function readXmlFromBody(body: string) {
  const trimmed = stripBom(body).trim();
  if (trimmed.startsWith("<")) return trimmed;

  const params = new URLSearchParams(trimmed);
  return (
    params.get("xml") ||
    params.get("XML") ||
    params.get("data") ||
    params.get("DATA") ||
    trimmed
  );
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const expectedToken = process.env.FAPTEKA_SITE_TOKEN?.trim();
  if (!expectedToken) {
    return NextResponse.json(
      { ok: false, error: "FAPTEKA_SITE_TOKEN .env da sozlanmagan" },
      { status: 503 },
    );
  }

  if (tokenFromRequest(request) !== expectedToken) {
    return NextResponse.json({ ok: false, error: "F-Apteka token noto'g'ri" }, { status: 401 });
  }

  const xml = readXmlFromBody(
    decodeXmlBuffer(await request.arrayBuffer(), request.headers.get("content-type") ?? undefined),
  );
  const rows = parseFaptekaXml(xml);
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "XML ichida F-Apteka qatorlari topilmadi" }, { status: 400 });
  }

  // F-Apteka aynan qanday maydonlar yuborayotganini bilish uchun.
  // Kod hozir faqat tovar qatorlarini oladi (I/N/K/P/UN); agar bu yerda
  // chekka oid kalitlar ko'rinsa, demak savdo ham push bilan kelayotgan
  // bo'ladi va uni tortib olish mumkin — cron kerak bo'lmaydi.
  const keyCounts = new Map<string, number>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
  }
  const keys = Array.from(keyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key}:${count}`);

  // "O" = otdel (filial) ID. F-Apteka'da: Sklad → FAPTEKA → Spravochnaya →
  // Filialy. Qaysi dorixonalardan ma'lumot kelayotganini shundan bilamiz.
  const otdelCounts = new Map<string, number>();
  for (const row of rows) {
    const otdel = (row.O ?? "").trim();
    if (!otdel) continue;
    otdelCounts.set(otdel, (otdelCounts.get(otdel) ?? 0) + 1);
  }
  const otdels = Array.from(otdelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => `O=${id}:${count}`)
    .join(", ");

  const summary = await syncFaptekaSiteRows(rows);
  console.info("F-Apteka SITE.exe push", {
    receivedRows: summary.receivedRows,
    productsUpserted: summary.productsUpserted,
    skippedRows: summary.skippedRows,
    keys,
    otdels,
    sampleRow: rows[0] ?? null,
    durationMs: Date.now() - startedAt,
    ok: summary.ok,
  });

  // Bazaga ham yozamiz: Vercel Hobby'da loglar qisqa saqlanadi, bu esa
  // qolib ketadi va istalgan vaqtda SQL bilan ko'riladi.
  try {
    await db.integrationLog.create({
      data: {
        source: "fapteka-site",
        rowCount: summary.receivedRows,
        keys: keys.join(", ").slice(0, 2000),
        sample: JSON.stringify(rows[0] ?? {}).slice(0, 2000),
        note: `upsert=${summary.productsUpserted}, skip=${summary.skippedRows}` +
          (otdels ? ` | ${otdels}` : " | otdel yo'q"),
        ok: summary.ok,
      },
    });
  } catch {
    // Jurnalga yozilmasa ham asosiy ish buzilmasin
  }

  revalidatePath("/sozlamalar");
  revalidatePath("/ombor");
  revalidatePath("/pos");
  revalidatePath("/moliya");
  revalidatePath("/harajatlar");
  revalidatePath("/hisobotlar");

  return NextResponse.json({ ok: summary.ok, summary }, { status: summary.ok ? 200 : 207 });
}
