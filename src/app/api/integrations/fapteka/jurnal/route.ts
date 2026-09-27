import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { otdelUnitMap } from "@/lib/integrations/fapteka/otdel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Integratsiya jurnali — nima kelayotganini tekshirish uchun.
 *
 *   /api/integrations/fapteka/jurnal?token=<FAPTEKA_SITE_TOKEN>
 *   ...&manba=fapteka-report&soni=20
 *
 * Eng foydali joyi: "maydonlar" ustuni. F-Apteka hisobotida qaysi ustunlar
 * kelayotganini ko'rsatadi. Masalan kirimda "O" bo'lsa — harajat aniq
 * dorixonaga yoziladi; bo'lmasa hammasi "Umumiy" bo'lib qoladi.
 */

function allowed(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim() || process.env.FAPTEKA_SITE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return bearer === expected || request.nextUrl.searchParams.get("token")?.trim() === expected;
}

export async function GET(request: NextRequest) {
  if (!allowed(request)) {
    return NextResponse.json({ ok: false, error: "Token noto'g'ri" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const take = Math.min(Math.max(Number(params.get("soni") ?? 20) || 20, 1), 100);
  const source = params.get("manba")?.trim();
  // Faqat bitta hisobot turi kerak bo'lsa: ...&izoh=incoming
  const noteLike = params.get("izoh")?.trim();

  const rows = await db.integrationLog.findMany({
    where: {
      ...(source ? { source } : {}),
      ...(noteLike ? { note: { contains: noteLike, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: { createdAt: true, source: true, rowCount: true, note: true, keys: true, sample: true, ok: true },
  });

  // Kirim hisobotida otdel ustuni bormi — "Umumiy" muammosining javobi shu
  const incoming = rows.find((row) => row.note?.includes("incoming") && row.keys);
  const otdelBor = incoming?.keys ? /(^|,)\s*O\s*:/.test(incoming.keys) : null;

  return NextResponse.json({
    ok: true,
    otdelUstuni:
      otdelBor === null
        ? "kirim jurnali topilmadi — relay ishlagandan keyin qayta qarang"
        : otdelBor
          ? "bor — harajat aniq dorixonaga yoziladi"
          : "YO'Q — F-Apteka kirimda filialni bermayapti, shuning uchun Umumiy",
    otdelMosligi: Object.fromEntries(otdelUnitMap()),
    yozuvlar: rows.map((row) => ({
      vaqt: row.createdAt.toISOString(),
      manba: row.source,
      qator: row.rowCount,
      ok: row.ok,
      izoh: row.note,
      maydonlar: row.keys,
      namuna: row.sample,
    })),
  });
}
