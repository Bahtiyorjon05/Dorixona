"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { monthName } from "@/lib/format";
import { activeBranch, fail, requireUser, type ActionResult } from "./_shared";

const schema = z.object({
  title: z.string().min(2, "Nomi kamida 2 belgi"),
  category: z.enum(["RENT", "UTILITIES", "GOODS", "SALARY", "LICENSE", "OTHER"]),
  amount: z.number().positive("Summa musbat bo'lishi kerak"),
  spentAt: z.string().optional(),
  isRecurring: z.boolean().default(false),
  unit: z.string().optional(),
});

/** Bo'sh yoki "Umumiy" bo'lsa null saqlaymiz (umumiy xarajat). */
function normalizeUnit(unit?: string) {
  const value = unit?.trim();
  if (!value || value === "Umumiy") return null;
  return value;
}

function revalidateAll() {
  revalidatePath("/harajatlar");
  revalidatePath("/moliya");
  revalidatePath("/hisobotlar");
}

export async function createExpense(input: z.input<typeof schema>): Promise<ActionResult> {
  try {
    await requireUser();
    const data = schema.parse(input);
    const branch = await activeBranch();
    await db.expense.create({
      data: {
        title: data.title.trim(),
        category: data.category,
        amount: data.amount,
        isRecurring: data.isRecurring,
        unit: normalizeUnit(data.unit),
        spentAt: data.spentAt ? new Date(data.spentAt) : new Date(),
        branchId: branch.id,
      },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateExpense(
  id: string,
  input: z.input<typeof schema>,
): Promise<ActionResult> {
  try {
    await requireUser();
    if (!id) return { ok: false, error: "Harajat topilmadi" };
    const data = schema.parse(input);
    await db.expense.update({
      where: { id },
      data: {
        title: data.title.trim(),
        category: data.category,
        amount: data.amount,
        isRecurring: data.isRecurring,
        unit: normalizeUnit(data.unit),
        ...(data.spentAt ? { spentAt: new Date(data.spentAt) } : {}),
      },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    await db.expense.delete({ where: { id } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Harajat kiritilgan dorixona birliklari (tanlov ro'yxati uchun). */
export async function listExpenseUnits(): Promise<string[]> {
  const rows = await db.expense.findMany({
    where: { unit: { not: null } },
    select: { unit: true },
    distinct: ["unit"],
    orderBy: { unit: "asc" },
  });
  return rows.map((r) => r.unit!).filter(Boolean);
}

export type CopyResult =
  | { ok: true; created: number; skipped: number; fromLabel: string }
  | { ok: false; error: string };

/**
 * Oldingi oydagi takrorlanuvchi (isRecurring) harajatlarni tanlangan oyga
 * nusxalaydi — ijara, kommunal, oyliklar va shunga o'xshash har oy
 * qaytariladigan yozuvlarni qayta-qayta qo'lda kiritmaslik uchun.
 *
 * Bir xil nom + dorixona kombinatsiyasi maqsad oyda allaqachon bo'lsa,
 * o'sha qator o'tkazib yuboriladi. Shuning uchun tugmani ikki marta
 * bossangiz ham dublikat paydo bo'lmaydi.
 */
export async function copyRecurringExpenses(input: {
  year: number;
  month: number;
}): Promise<CopyResult> {
  try {
    await requireUser();
    const branch = await activeBranch();

    const targetStart = new Date(input.year, input.month - 1, 1);
    const targetEnd = new Date(input.year, input.month, 1);
    const sourceStart = new Date(input.year, input.month - 2, 1);

    const [source, existing] = await Promise.all([
      db.expense.findMany({
        where: {
          branchId: branch.id,
          isRecurring: true,
          spentAt: { gte: sourceStart, lt: targetStart },
        },
      }),
      db.expense.findMany({
        where: { branchId: branch.id, spentAt: { gte: targetStart, lt: targetEnd } },
        select: { title: true, unit: true },
      }),
    ]);

    const fromLabel = `${monthName(sourceStart.getMonth() + 1)} ${sourceStart.getFullYear()}`;
    if (source.length === 0) {
      return { ok: false, error: `${fromLabel} oyida takrorlanuvchi harajat yo'q` };
    }

    const seen = new Set(existing.map((e) => `${e.title}|${e.unit ?? ""}`));
    // Manba kunini saqlaymiz, lekin qisqa oyga tushib qolmasin (31 -> 30)
    const daysInTarget = new Date(input.year, input.month, 0).getDate();

    let created = 0;
    for (const row of source) {
      if (seen.has(`${row.title}|${row.unit ?? ""}`)) continue;
      const day = Math.min(row.spentAt.getDate(), daysInTarget);
      await db.expense.create({
        data: {
          title: row.title,
          category: row.category,
          amount: row.amount,
          isRecurring: true,
          unit: row.unit,
          spentAt: new Date(input.year, input.month - 1, day, 12),
          branchId: branch.id,
        },
      });
      created += 1;
    }

    revalidateAll();
    return { ok: true, created, skipped: source.length - created, fromLabel };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Xatolik yuz berdi" };
  }
}
