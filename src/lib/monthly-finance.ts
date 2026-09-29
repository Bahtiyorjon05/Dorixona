import "server-only";
import { db } from "@/lib/db";
import { FILIALS } from "@/lib/filial";

/**
 * Oylik moliyaviy xulosani bazadagi savdodan qayta hisoblaydi.
 *
 * Sessiyaga bog'liq emas — shuning uchun uni ham server action (foydalanuvchi
 * ⟳ bosganda), ham cron endpoint (avtomatik) chaqira oladi.
 *
 * MUHIM: shu oyda savdo topilmasa, HECH NARSA YOZILMAYDI. Aks holda
 * qo'lda kiritilgan raqamlar (masalan avgust: 671 mln) nol bilan ustiga
 * yozilib ketardi — F-Apteka sync hali ulanmagan bo'lsa aynan shunday
 * bo'lardi.
 *
 * Faqat `turnover` va `profit` yangilanadi. `stockValue` (astatka) va
 * `revaluation` (pereotsenka) qo'lda kiritiladi va bu yerda tegilmaydi:
 * `Product` da dorixona ajratmasi yo'q, qoldiq esa tarixsiz.
 */
/** Mahalliy sana → DailySales.day formati (UTC yarim tun) */
export const utcDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

/** QQS (НДС) stavkasi — F-Apteka foydani QQSsiz ko'rsatadi */
const VAT_RATE = 0.12;
/** Chakana savdo hujjatlari: 2 = sotuv, 4 = qaytarish (summasi manfiy) */
const RETAIL_DOC_TYPES = ["2", "4"];

export type RetailTotals = { turnover: number; cost: number; profit: number; known: boolean };

/**
 * Chakana savdo va foyda — F-Apteka'ning 22-hisobotidan kelgan kunlik
 * jamlanmadan (DailySales). F-Apteka'dagi "Продажи за период" bilan bir xil:
 *   savdo  = Сумма (qaytarish ayirilgan)
 *   foyda  = (Сумма − Сумма со скидкой) − (НДС продажи − НДС прихода)
 * Sotuv QQSi 12%, xarid QQSi har tovarning kirimdagi stavkasidan (QQSsiz
 * yetkazib beruvchilar bor: sentabr, Yunusobod — 12% deb olinsa foyda
 * ~511 ming ortiq chiqardi).
 *
 * `Sale` cheklaridan hisoblash savdoni oshirib ko'rsatardi (sentabr,
 * Shayxontohur: 741,4 mln o'rniga 718,9 mln bo'lishi kerak edi).
 *
 * unit = null — hamma dorixona. `day` UTC yarim tunda saqlanadi.
 */
/** Hamma xarid QQS bilan (12%) bo'lsa, tan narxdagi QQS ulushi */
const DEFAULT_COST_VAT_SHARE = VAT_RATE / (1 + VAT_RATE);

/**
 * Foyda F-Apteka'dagi kabi: (Сумма − Сумма со скидкой) − (НДС продажи − НДС прихода).
 * Sotuv QQSi hamma tovarda 12%; xarid QQSi esa yetkazib beruvchiga bog'liq
 * (QQSsiz ishlaydiganlari bor) — shuning uchun tan narxdagi ulushi alohida.
 */
function profitWithoutVat(turnover: number, cost: number, costVatShare: number) {
  const saleVat = (turnover * VAT_RATE) / (1 + VAT_RATE);
  return turnover - cost - (saleVat - cost * costVatShare);
}

/**
 * Sotilgan tovarlar tan narxidagi xarid QQSi ulushi — har tovarning kirimdagi
 * stavkasidan (Product."purchaseVatRate", kirim hisobotidan SN/SP), tan narx
 * bo'yicha o'rtacha. Stavkasi noma'lum tovar 12% deb olinadi. Ustun yoki
 * ma'lumot bo'lmasa — hammasi 12%.
 */
async function purchaseVatShare(from: Date, to: Date, unit: string | null) {
  try {
    const [row] = await db.$queryRaw<{ share: number | null }[]>`
      SELECT (SUM(si."costPrice" * si.quantity *
                  COALESCE(p."purchaseVatRate", ${VAT_RATE}) / (1 + COALESCE(p."purchaseVatRate", ${VAT_RATE})))
              / NULLIF(SUM(si."costPrice" * si.quantity), 0))::float8 AS share
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      JOIN "Product" p ON p.id = si."productId"
      WHERE s."createdAt" >= ${from} AND s."createdAt" < ${to}
        AND (${unit}::text IS NULL OR s."unit" = ${unit})`;
    const share = Number(row?.share);
    return Number.isFinite(share) && share >= 0 ? share : DEFAULT_COST_VAT_SHARE;
  } catch {
    return DEFAULT_COST_VAT_SHARE;
  }
}

export async function retailTotals(from: Date, to: Date, unit: string | null): Promise<RetailTotals> {
  try {
    const [agg, costVatShare] = await Promise.all([
      db.dailySales.aggregate({
        _sum: { amount: true, cost: true },
        _count: true,
        where: { day: { gte: from, lt: to }, docType: { in: RETAIL_DOC_TYPES }, ...(unit ? { unit } : {}) },
      }),
      purchaseVatShare(from, to, unit),
    ]);
    const turnover = Number(agg._sum.amount ?? 0);
    const cost = Number(agg._sum.cost ?? 0);
    return { turnover, cost, profit: profitWithoutVat(turnover, cost, costVatShare), known: agg._count > 0 };
  } catch {
    // Jadval hali yaratilmagan
    return { turnover: 0, cost: 0, profit: 0, known: false };
  }
}

/**
 * Kun × dorixona bo'yicha chakana savdo va QQSsiz foyda (DailySales).
 * Bo'sh ro'yxat — jamlanma yo'q, chaqiruvchi eski hisobga qaytadi.
 */
export async function retailDaily(from: Date, to: Date, unit: string | null) {
  try {
    const [rows, costVatShare] = await Promise.all([
      db.dailySales.groupBy({
        by: ["day", "unit"],
        _sum: { amount: true, cost: true },
        where: { day: { gte: from, lt: to }, docType: { in: RETAIL_DOC_TYPES }, ...(unit ? { unit } : {}) },
      }),
      // Butun oraliq uchun bitta ulush — kunma-kun hisoblash shart emas
      purchaseVatShare(from, to, unit),
    ]);
    return rows.map((row) => {
      const turnover = Number(row._sum.amount ?? 0);
      const cost = Number(row._sum.cost ?? 0);
      return { day: row.day, unit: row.unit, turnover, profit: profitWithoutVat(turnover, cost, costVatShare) };
    });
  } catch {
    return [];
  }
}

/**
 * DailySales kunlarini mahalliy sana bo'yicha yig'adi. Kalit — mahalliy
 * yarim tun (grafiklar startOfDay bilan solishtiradi); `monthly` bo'lsa oy boshi.
 */
export function retailByLocalDate(
  rows: { day: Date; turnover: number; profit: number }[],
  monthly = false,
) {
  const map = new Map<number, { turnover: number; profit: number }>();
  for (const row of rows) {
    const d = new Date(row.day);
    const key = new Date(d.getUTCFullYear(), d.getUTCMonth(), monthly ? 1 : d.getUTCDate()).getTime();
    const entry = map.get(key) ?? { turnover: 0, profit: 0 };
    entry.turnover += row.turnover;
    entry.profit += row.profit;
    map.set(key, entry);
  }
  return map;
}

/**
 * Oylik xulosa qatorlaridagi savdo va foydani kunlik jamlanmadan
 * yangilaydi (joyida). Bazadagi raqam faqat ko'prik skript ishlaganda yoki
 * ⟳ bosilganda yangilanadi — ko'rsatishda esa har doim F-Apteka bilan bir
 * xil raqam chiqsin. Jamlanmasi yo'q oy va "Umumiy" qatori tegilmaydi.
 */
export async function overlayRetail(
  rows: { unit: string; periodMonth: Date; turnover: unknown; profit: unknown }[],
) {
  await Promise.all(
    rows
      .filter((row) => row.unit !== "Umumiy")
      .map(async (row) => {
        const start = new Date(row.periodMonth);
        const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
        const retail = await retailTotals(start, end, row.unit);
        if (retail.known) Object.assign(row, { turnover: retail.turnover, profit: retail.profit });
      }),
  );
  return rows;
}

export type RecomputeResult = {
  unit: string;
  year: number;
  month: number;
  turnover: number;
  profit: number;
  salesCount: number;
  /** true = savdo topilmadi, yozuvga tegilmadi */
  skipped: boolean;
};

export async function recomputeMonthlyFinance(input: {
  branchId: string;
  unit: string;
  year: number;
  month: number;
}): Promise<RecomputeResult> {
  const { branchId, unit, year, month } = input;
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  // "Umumiy" = dorixonaga ajratilmagan cheklar (Sale.unit IS NULL)
  const isUnassigned = unit === "Umumiy";

  const marginQuery = isUnassigned
    ? db.$queryRaw<{ margin: number }[]>`
        SELECT COALESCE(SUM(si."lineTotal" - si."costPrice" * si.quantity), 0)::float8 AS margin
        FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
        WHERE s."branchId" = ${branchId} AND s."unit" IS NULL
          AND s."createdAt" >= ${from} AND s."createdAt" < ${to}`
    : db.$queryRaw<{ margin: number }[]>`
        SELECT COALESCE(SUM(si."lineTotal" - si."costPrice" * si.quantity), 0)::float8 AS margin
        FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
        WHERE s."branchId" = ${branchId} AND s."unit" = ${unit}
          AND s."createdAt" >= ${from} AND s."createdAt" < ${to}`;

  const [agg, marginRows] = await Promise.all([
    db.sale.aggregate({
      _sum: { total: true },
      _count: true,
      where: { branchId, unit: isUnassigned ? null : unit, createdAt: { gte: from, lt: to } },
    }),
    marginQuery,
  ]);

  // Kunlik jamlanma bor oylarda — F-Apteka bilan bir xil hisob
  const retail = await retailTotals(
    new Date(Date.UTC(year, month - 1, 1)),
    new Date(Date.UTC(year, month, 1)),
    unit,
  );
  const turnover = retail.known ? retail.turnover : Number(agg._sum.total ?? 0);
  const profit = retail.known ? retail.profit : Number(marginRows[0]?.margin ?? 0);
  const base = { unit, year, month, turnover, profit, salesCount: agg._count };

  // Savdo yo'q — qo'lda kiritilganini saqlab qolamiz
  if (agg._count === 0 && !retail.known) return { ...base, skipped: true };

  const periodMonth = new Date(Date.UTC(year, month - 1, 1));
  await db.monthlyFinance.upsert({
    where: { unit_periodMonth: { unit, periodMonth } },
    create: { unit, periodMonth, branchId, turnover, profit },
    update: { turnover, profit },
  });

  return { ...base, skipped: false };
}

/** Sana oralig'iga tushadigan har oy × har dorixona uchun qayta hisoblash */
export async function recomputeRange(input: {
  branchId: string;
  from: Date;
  to: Date;
}): Promise<RecomputeResult[]> {
  const months: { year: number; month: number }[] = [];
  const cursor = new Date(input.from.getFullYear(), input.from.getMonth(), 1);
  const last = new Date(input.to.getFullYear(), input.to.getMonth(), 1);
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const updated: RecomputeResult[] = [];
  for (const period of months) {
    for (const unit of FILIALS) {
      const result = await recomputeMonthlyFinance({ branchId: input.branchId, unit, ...period });
      if (!result.skipped) updated.push(result);
    }
  }
  return updated;
}
