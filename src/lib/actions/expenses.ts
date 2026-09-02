"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
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
