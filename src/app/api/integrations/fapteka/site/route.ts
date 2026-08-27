import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
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

  const summary = await syncFaptekaSiteRows(rows);
  console.info("F-Apteka SITE.exe push", {
    receivedRows: summary.receivedRows,
    productsUpserted: summary.productsUpserted,
    skippedRows: summary.skippedRows,
    durationMs: Date.now() - startedAt,
    ok: summary.ok,
  });

  revalidatePath("/sozlamalar");
  revalidatePath("/ombor");
  revalidatePath("/pos");
  revalidatePath("/moliya");
  revalidatePath("/harajatlar");
  revalidatePath("/hisobotlar");

  return NextResponse.json({ ok: summary.ok, summary }, { status: summary.ok ? 200 : 207 });
}
