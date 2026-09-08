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

  const turnover = Number(agg._sum.total ?? 0);
  const profit = Number(marginRows[0]?.margin ?? 0);
  const base = { unit, year, month, turnover, profit, salesCount: agg._count };

  // Savdo yo'q — qo'lda kiritilganini saqlab qolamiz
  if (agg._count === 0) return { ...base, skipped: true };

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
