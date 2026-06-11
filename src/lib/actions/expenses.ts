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
});

export async function createExpense(input: z.input<typeof schema>): Promise<ActionResult> {
  try {
    await requireUser();
    const data = schema.parse(input);
    const branch = await activeBranch();
    await db.expense.create({
      data: {
        title: data.title,
        category: data.category,
        amount: data.amount,
        isRecurring: data.isRecurring,
        spentAt: data.spentAt ? new Date(data.spentAt) : new Date(),
        branchId: branch.id,
      },
    });
    revalidatePath("/harajatlar");
    revalidatePath("/moliya");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    await db.expense.delete({ where: { id } });
    revalidatePath("/harajatlar");
    revalidatePath("/moliya");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
