import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decodeXmlBuffer, parseFaptekaXml, type FaptekaRow } from "@/lib/integrations/fapteka/client";
import {
  isFaptekaPushReport,
  syncFaptekaCostPrices,
  syncFaptekaIncomingSuppliers,
  syncFaptekaOrganizations,
  syncFaptekaPushedReport,
  syncFaptekaSalesTotals,
} from "@/lib/integrations/fapteka/sync";
import { recomputeRange } from "@/lib/monthly-finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * F-Apteka hisobot API'si (P_GetReport_XML) dorixonaning ichki tarmog'ida
 * (192.168.x.x) turadi — Vercel unga yetolmaydi. Shuning uchun dorixona
 * kompyuteridagi ko'prik skript (scripts/fapteka-relay) hisobotni o'zi oladi
 * va shu yerga yuboradi.
 *
 *   POST /api/integrations/fapteka/report
 *        ?report=retailSaleV2&filial=2&dateFrom=2026-09-22&dateTo=2026-09-22
 *   Authorization: Bearer <FAPTEKA_SITE_TOKEN>
 *   body: API qaytargan XML (o'zgartirilmagan)
 */

function tokenFromRequest(request: NextRequest) {
  const auth = request.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return bearer || request.headers.get("x-fapteka-token")?.trim() || "";
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function fieldKeys(rows: FaptekaRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const key of Object.keys(row)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key}:${count}`)
    .join(", ");
}

async function writeLog(data: { rowCount: number; keys?: string; sample?: string; note: string; ok: boolean }) {
  try {
    await db.integrationLog.create({ data: { source: "fapteka-report", ...data } });
  } catch {
    // Jurnalga yozilmasa ham asosiy ish buzilmasin
  }
}

/** Oylik moliyaviy xulosani yangilaydi; xato bo'lsa asosiy ishni buzmaydi */
async function recomputeSafely(dateFrom: string, dateTo: string) {
  try {
    const branch = await db.branch.findFirst({ where: { isActive: true } });
    if (!branch) return 0;
    const updated = await recomputeRange({ branchId: branch.id, from: new Date(dateFrom), to: new Date(dateTo) });
    return updated.length;
  } catch {
    return 0;
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const expectedToken = process.env.FAPTEKA_SITE_TOKEN?.trim();
  if (!expectedToken) {
    return NextResponse.json({ ok: false, error: "FAPTEKA_SITE_TOKEN .env da sozlanmagan" }, { status: 503 });
  }
  if (tokenFromRequest(request) !== expectedToken) {
    return NextResponse.json({ ok: false, error: "F-Apteka token noto'g'ri" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const report = params.get("report");
  const filialId = params.get("filial")?.trim() ?? "";
  const dateFrom = params.get("dateFrom")?.trim() ?? "";
  const dateTo = params.get("dateTo")?.trim() || dateFrom;
  if (!isFaptekaPushReport(report)) {
    return NextResponse.json({ ok: false, error: "report noma'lum" }, { status: 400 });
  }
  if (!/^\d+$/.test(filialId) || !DAY.test(dateFrom) || !DAY.test(dateTo)) {
    return NextResponse.json({ ok: false, error: "filial yoki sana noto'g'ri" }, { status: 400 });
  }

  const label = `${report} F=${filialId} ${dateFrom}${dateTo !== dateFrom ? `..${dateTo}` : ""}`;
  const text = decodeXmlBuffer(await request.arrayBuffer(), request.headers.get("content-type") ?? undefined)
    .replace(/^[\uFEFF\uFFFE\u0000]+/, "")
    .trim();

  // API xato sahifasi (XML bo'lmagan javob) kelsa, bazaga tegmaymiz —
  // aks holda o'sha kunning harakatlari o'chib ketardi.
  if (!text.startsWith("<")) {
    await writeLog({ rowCount: 0, sample: text.slice(0, 500), note: `${label} | XML emas`, ok: false });
    return NextResponse.json({ ok: false, error: "Javob XML emas" }, { status: 400 });
  }

  const rows = parseFaptekaXml(text);
  if (!rows.length) {
    // Bo'sh kun (hali savdo yo'q) yoki API xatosi — ikkala holatda ham tegmaymiz
    await writeLog({ rowCount: 0, sample: text.slice(0, 500), note: `${label} | qator yo'q`, ok: true });
    return NextResponse.json({ ok: true, rows: 0 });
  }

  // Tashkilotlar ro'yxati sana va filialga bog'liq emas
  if (report === "organizations") {
    const orgs = await syncFaptekaOrganizations(rows);
    await writeLog({
      rowCount: rows.length,
      keys: fieldKeys(rows).slice(0, 2000),
      note: `${label} | tashkilot: ${orgs.saved} ta, ${Date.now() - startedAt}ms`,
      ok: true,
    });
    return NextResponse.json({ ok: true, orgs });
  }

  // 22-hisobot: kun bo'yicha haqiqiy tan narx — savdo bandlariga tarqatiladi
  if (report === "salesTotals") {
    const totals = await syncFaptekaSalesTotals({ rows, filialId, dateFrom, dateTo });
    // F-Apteka aytgan tushum bilan bizdagisi solishtiriladi: farq katta
    // bo'lsa, savdo hisoboti to'liq tushmagan bo'ladi
    const diff = totals.reported > 0 ? Math.round((1 - totals.erpTurnover / totals.reported) * 100) : 0;
    await writeLog({
      rowCount: rows.length,
      keys: fieldKeys(rows).slice(0, 2000),
      note:
        `${label} | tan narx: ${Math.round(totals.reportedCost)}, ERP tushum: ${Math.round(totals.erpTurnover)}, ` +
        `F-Apteka tushum: ${Math.round(totals.reported)} (farq ${diff}%), ${totals.updated} band`,
      ok: true,
    });
    await recomputeSafely(dateFrom, dateTo);
    revalidatePath("/savdo");
    revalidatePath("/moliya");
    return NextResponse.json({ ok: true, totals });
  }

  // 20-hisobot: harajat nomiga yetkazib beruvchini qo'shadi
  if (report === "incomingTotals") {
    const result = await syncFaptekaIncomingSuppliers({ rows, dateFrom, dateTo });
    await writeLog({
      rowCount: rows.length,
      keys: fieldKeys(rows).slice(0, 2000),
      note: `${label} | yetkazib beruvchi yozildi: ${result.updated} ta, noma'lum: ${result.unknownOrgs}`,
      ok: true,
    });
    revalidatePath("/harajatlar");
    return NextResponse.json({ ok: true, result });
  }

  // costOnly: eski kirimlardan faqat tan narx olinadi (harajat yozilmaydi)
  if (params.get("costOnly") === "1") {
    const cost = await syncFaptekaCostPrices(rows);
    await writeLog({
      rowCount: rows.length,
      keys: fieldKeys(rows).slice(0, 2000),
      note: `${label} | faqat tan narx: ${cost.productsUpdated} ta tovar, ${Date.now() - startedAt}ms`,
      ok: true,
    });
    revalidatePath("/ombor");
    return NextResponse.json({ ok: true, cost });
  }

  const summary = await syncFaptekaPushedReport({ report, rows, filialId, dateFrom, dateTo });

  // Savdo tushgach oylik moliyaviy xulosani yangilaymiz (auto sync kabi)
  let financeUpdated = 0;
  try {
    const branch = await db.branch.findFirst({ where: { isActive: true } });
    if (branch) {
      const updated = await recomputeRange({ branchId: branch.id, from: new Date(dateFrom), to: new Date(dateTo) });
      financeUpdated = updated.length;
    }
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : "Moliya yangilanmadi");
  }

  await writeLog({
    rowCount: rows.length,
    keys: fieldKeys(rows).slice(0, 2000),
    sample: JSON.stringify(rows[0]).slice(0, 2000),
    note:
      `${label} | chek=${summary.salesUpserted}, harakat=${summary.movementsCreated}, ` +
      `harajat=${summary.expensesCreated}, ${Date.now() - startedAt}ms` +
      (summary.errors.length ? ` | ${summary.errors.join("; ").slice(0, 500)}` : ""),
    ok: summary.ok,
  });

  revalidatePath("/pos");
  revalidatePath("/analitika");
  revalidatePath("/ombor");
  revalidatePath("/moliya");
  revalidatePath("/harajatlar");
  revalidatePath("/hisobotlar");

  return NextResponse.json({ ok: summary.ok, summary, financeUpdated }, { status: summary.ok ? 200 : 207 });
}
