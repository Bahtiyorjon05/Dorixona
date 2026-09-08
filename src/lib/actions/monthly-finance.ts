"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isFilial } from "@/lib/filial";
import { recomputeMonthlyFinance } from "@/lib/monthly-finance";
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
  | { ok: true; turnover: number; profit: number; salesCount: number; skipped: boolean }
  | { ok: false; error: string };

/**
 * Savdo va foydani bazadagi haqiqiy savdodan (POS + F-Apteka sync) hisoblab,
 * MonthlyFinance'ga yozadi.
 *
 * Shu oyda chek topilmasa hech narsa yozilmaydi — qo'lda kiritilgan raqamlar
 * nol bilan almashib ketmasligi uchun. F-Apteka sync hozircha `Sale.unit` ni
 * to'ldirmaydi, shuning uchun natija ko'pincha "savdo topilmadi" bo'ladi.
 *
 * Astatka va pereotsenkaga tegilmaydi: `Product` da dorixona ajratmasi yo'q,
 * qoldiq esa tarixsiz.
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
    const result = await recomputeMonthlyFinance({
      branchId: branch.id,
      unit,
      year: input.year,
      month: input.month,
    });
    if (!result.skipped) revalidateAll();
    return {
      ok: true,
      turnover: result.turnover,
      profit: result.profit,
      salesCount: result.salesCount,
      skipped: result.skipped,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Xatolik yuz berdi" };
  }
}
