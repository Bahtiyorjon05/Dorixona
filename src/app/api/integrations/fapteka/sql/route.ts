import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  syncFaptekaIncomingSuppliers,
  syncFaptekaSupplierDebts,
} from "@/lib/integrations/fapteka/sync";
import type { FaptekaRow } from "@/lib/integrations/fapteka/client";
import { syncRevaluationFromDb, type RevaluationDbRow } from "@/lib/revaluation";
import { syncShiftsFromDb, type ShiftDbRow } from "@/lib/cashiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * F-Apteka bazasidan to'g'ridan-to'g'ri olingan ma'lumot.
 *
 * Nega kerak: 20-hisobot (Приходы, hujjat jamlanmasi) protsedurasida
 * `SELECT TOP 1 *` turibdi — bir so'rovga bitta hujjat qaytaradi. Kunida
 * bir necha kirim bo'lsa, qolgani ERP ga umuman tushmaydi va firmaga
 * qarz yarim ko'rinadi. Tekshirilgan: 29.09.2026 da 3 ta hujjat bo'lgan,
 * hisobot 1 tasini bergan.
 *
 * Shuning uchun relay skript dorixona kompyuterida MSSQL dan o'qiydi va
 * hujjatlarni shu yerga yuboradi. Baza o'sha kompyuterda, parol ham
 * o'sha yerda qoladi — bu yerga faqat tayyor qatorlar keladi.
 *
 * Qatorlar 20-hisobot maydonlari nomi bilan keladi (N, O, D, SS), shunda
 * mavjud sinxronizatsiya kodi o'zgarishsiz ishlaydi.
 */

type SqlPayload = {
  kind?: string;
  dateFrom?: string;
  dateTo?: string;
  rows?: FaptekaRow[];
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function allowed(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim() || process.env.FAPTEKA_SITE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return bearer === expected || request.nextUrl.searchParams.get("token")?.trim() === expected;
}

async function writeLog(data: { rowCount: number; note: string; ok: boolean; sample?: string }) {
  try {
    await db.integrationLog.create({ data: { source: "fapteka-sql", ...data } });
  } catch {
    // Jurnal yozilmasa ham asosiy ish buzilmasin
  }
}

export async function POST(request: NextRequest) {
  if (!allowed(request)) {
    return NextResponse.json({ ok: false, error: "Token noto'g'ri" }, { status: 401 });
  }

  let payload: SqlPayload;
  try {
    payload = (await request.json()) as SqlPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON o'qilmadi" }, { status: 400 });
  }

  // PowerShell ConvertTo-Json bitta elementli ro'yxatni ba'zan obyekt
  // qilib yuboradi — o'shani ham qabul qilamiz
  const raw = payload.rows;
  const rows: FaptekaRow[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  const dateFrom = payload.dateFrom ?? "";
  const dateTo = payload.dateTo ?? dateFrom;
  if (!DAY.test(dateFrom) || !DAY.test(dateTo)) {
    return NextResponse.json({ ok: false, error: "Sana yyyy-mm-dd bo'lishi kerak" }, { status: 400 });
  }

  // Pereotsenka (REVAL/REVALLN) — kun × otdel jamlanmasi, butun oy bo'yicha.
  // Bo'sh ro'yxat ham qabul qilinadi: oy boshida hujjat yo'q bo'lsa nol yoziladi.
  if (payload.kind === "revaluation") {
    const label = `revaluation ${dateFrom}..${dateTo}`;
    try {
      const result = await syncRevaluationFromDb({ rows: rows as RevaluationDbRow[], dateFrom, dateTo });
      await writeLog({
        rowCount: rows.length,
        sample: rows.length ? JSON.stringify(rows[0]).slice(0, 500) : undefined,
        note:
          `${label} | ${result.days} kun×dorixona` +
          (result.skipped ? `, o'tkazildi: ${result.skipped}` : "") +
          ` | ${result.totals.map((t) => `${t.month} ${t.unit}: ${Math.round(t.loss)}`).join(", ")}`,
        ok: true,
      });
      revalidatePath("/harajatlar");
      revalidatePath("/moliya");
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "xato";
      await writeLog({ rowCount: rows.length, note: `${label} | XATO: ${message}`, ok: false });
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  // Kassir smenalari (INVOICE: SMENA x USERS jamlanmasi)
  if (payload.kind === "shifts") {
    const label = `shifts ${dateFrom}..${dateTo}`;
    try {
      const result = await syncShiftsFromDb(rows as ShiftDbRow[]);
      await writeLog({
        rowCount: rows.length,
        sample: rows.length ? JSON.stringify(rows[0]).slice(0, 500) : undefined,
        note: `${label} | smena: ${result.saved}` + (result.skipped ? `, o'tkazildi: ${result.skipped}` : ""),
        ok: true,
      });
      revalidatePath("/savdo");
      revalidatePath("/kpi");
      revalidatePath("/hisobotlar");
      revalidatePath("/davomat");
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "xato";
      await writeLog({ rowCount: rows.length, note: `${label} | XATO: ${message}`, ok: false });
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  if (payload.kind !== "incomingDocs") {
    return NextResponse.json({ ok: false, error: `Noma'lum turi: ${payload.kind}` }, { status: 400 });
  }

  const label = `incomingDocs ${dateFrom}..${dateTo}`;
  if (!rows.length) {
    await writeLog({ rowCount: 0, note: `${label} | hujjat yo'q`, ok: true });
    return NextResponse.json({ ok: true, rows: 0 });
  }

  try {
    // Harajat nomiga yetkazib beruvchi yoziladi
    const suppliers = await syncFaptekaIncomingSuppliers({ rows, dateFrom, dateTo });
    // Tovar olindi = firmaga qarz
    const debts = await syncFaptekaSupplierDebts(rows);

    await writeLog({
      rowCount: rows.length,
      sample: JSON.stringify(rows[0]).slice(0, 500),
      note:
        `${label} | hujjat: ${rows.length} ta` +
        ` | yetkazib beruvchi: ${suppliers.updated}, noma'lum: ${suppliers.unknownOrgs}` +
        ` | qarz: +${debts.created} yangi, ${debts.updated} yangilandi, ${debts.skipped} o'tkazildi`,
      ok: true,
    });

    revalidatePath("/qarzlar");
    revalidatePath("/harajatlar");

    return NextResponse.json({ ok: true, rows: rows.length, suppliers, debts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "xato";
    await writeLog({ rowCount: rows.length, note: `${label} | XATO: ${message}`, ok: false });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
