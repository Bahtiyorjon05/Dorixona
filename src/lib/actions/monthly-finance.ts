"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isFilial } from "@/lib/filial";
import { activeBranch, fail, requireUser, type ActionResult } from "./_shared";

/** Bo'sh satr -> null, aks holda son. Mln emas, so'mda saqlanadi. */
const amount = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v === null || v >= 0, "Summa manfiy bo'lishi mumkin emas");

const schema = z.object({
  unit: z.string().min(1, "Dorixona tanlanmagan"),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  turnover: amount,
  profit: amount,
  stockValue: amount,
  revaluation: amount,
  bankBalance: amount,
  note: z.string().max(500).optional().nullable(),
});

function revalidateAll() {
  revalidatePath("/harajatlar");
  revalidatePath("/moliya");
  revalidatePath("/hisobotlar");
}

/**
 * "Umumiy" ham haqiqiy qator: dorixonaga taqsimlanmagan summalar
 * (masalan umumiy pereotsenka) shu yerda saqlanadi — iyul ma'lumoti
 * ham shu tartibda kiritilgan.
 */
function assertUnit(unit: string) {
  if (!isFilial(unit)) throw new Error(`Noma'lum dorixona: ${unit}`);
  return unit;
}

/** Oylik moliyaviy xulosani qo'lda saqlaydi (unit + oy bo'yicha upsert) */
export async function saveMonthlyFinance(input: z.input<typeof schema>): Promise<ActionResult> {
  try {
    await requireUser();
    const data = schema.parse(input);
    const unit = assertUnit(data.unit);
    const branch = await activeBranch();
    const periodMonth = new Date(Date.UTC(data.year, data.month - 1, 1));

    const fields = {
      turnover: data.turnover ?? 0,
      profit: data.profit ?? 0,
      stockValue: data.stockValue ?? 0,
      revaluation: data.revaluation ?? 0,
      bankBalance: data.bankBalance,
      note: data.note?.trim() || null,
    };

    await db.monthlyFinance.upsert({
      where: { unit_periodMonth: { unit, periodMonth } },
      create: { unit, periodMonth, branchId: branch.id, ...fields },
      update: fields,
    });

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMonthlyFinance(input: {
  unit: string;
  year: number;
  month: number;
}): Promise<ActionResult> {
  try {
    await requireUser();
    const periodMonth = new Date(Date.UTC(input.year, input.month - 1, 1));
    await db.monthlyFinance.delete({
      where: { unit_periodMonth: { unit: input.unit, periodMonth } },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type AutofillResult =
  | { ok: true; turnover: number; profit: number; salesCount: number }
  | { ok: false; error: string };

/**
 * Savdo va foydani bazadagi haqiqiy savdodan (POS + F-Apteka sync) hisoblab,
 * MonthlyFinance'ga yozadi.
 *
 * Faqat `Sale.unit` shu dorixonaga teng bo'lgan cheklar qo'shiladi. F-Apteka
 * sync hozircha `unit` ni to'ldirmaydi (bitta FAPTEKA_FILIAL_ID bilan ishlaydi),
 * shuning uchun ikkinchi dorixona ulanmaguncha natija 0 chiqishi mumkin —
 * bu xato emas, ma'lumot yo'qligini bildiradi.
 *
 * Astatka va pereotsenka bu yerda hisoblanmaydi: `Product` jadvalida dorixona
 * ajratmasi yo'q, qoldiq esa tarixsiz (jonli qiymat). Ular qo'lda kiritiladi.
 */
export async function autofillMonthlyFinance(input: {
  unit: string;
  year: number;
  month: number;
}): Promise<AutofillResult> {
  try {
    await requireUser();
    const unit = assertUnit(input.unit);
    const branch = await activeBranch();
    const from = new Date(input.year, input.month - 1, 1);
    const to = new Date(input.year, input.month, 1);

    // "Umumiy" = dorixonaga ajratilmagan cheklar, ya'ni Sale.unit IS NULL
    const isUnassigned = unit === "Umumiy";
    const where = {
      branchId: branch.id,
      unit: isUnassigned ? null : unit,
      createdAt: { gte: from, lt: to },
    };

    const marginQuery = isUnassigned
      ? db.$queryRaw<{ margin: number }[]>`
          SELECT COALESCE(SUM(si."lineTotal" - si."costPrice" * si.quantity), 0)::float8 AS margin
          FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
          WHERE s."branchId" = ${branch.id} AND s."unit" IS NULL
            AND s."createdAt" >= ${from} AND s."createdAt" < ${to}`
      : db.$queryRaw<{ margin: number }[]>`
          SELECT COALESCE(SUM(si."lineTotal" - si."costPrice" * si.quantity), 0)::float8 AS margin
          FROM "SaleItem" si JOIN "Sale" s ON s.id = si."saleId"
          WHERE s."branchId" = ${branch.id} AND s."unit" = ${unit}
            AND s."createdAt" >= ${from} AND s."createdAt" < ${to}`;

    const [agg, marginRows] = await Promise.all([
      db.sale.aggregate({ _sum: { total: true }, _count: true, where }),
      marginQuery,
    ]);

    const turnover = Number(agg._sum.total ?? 0);
    const profit = Number(marginRows[0]?.margin ?? 0);
    const periodMonth = new Date(Date.UTC(input.year, input.month - 1, 1));

    // Faqat savdo va foyda yangilanadi — qo'lda kiritilgan astatka,
    // pereotsenka va bank qoldig'iga tegilmaydi.
    await db.monthlyFinance.upsert({
      where: { unit_periodMonth: { unit, periodMonth } },
      create: { unit, periodMonth, branchId: branch.id, turnover, profit },
      update: { turnover, profit },
    });

    revalidateAll();
    return { ok: true, turnover, profit, salesCount: agg._count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Xatolik yuz berdi" };
  }
}
