"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { activeBranch, fail, requireUser, type ActionResult } from "./_shared";

const createSchema = z.object({
  fullName: z.string().min(3, "To'liq ism kiriting"),
  position: z.string().min(2, "Lavozim kiriting"),
  phone: z.string().optional(),
  baseSalary: z.number().nonnegative(),
});

export async function createEmployee(input: z.input<typeof createSchema>): Promise<ActionResult> {
  try {
    await requireUser();
    const d = createSchema.parse(input);
    const branch = await activeBranch();
    await db.employee.create({
      data: {
        fullName: d.fullName,
        position: d.position,
        phone: d.phone || null,
        baseSalary: d.baseSalary,
        branchId: branch.id,
      },
    });
    revalidatePath("/xodimlar");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const updateSchema = z.object({
  id: z.string(),
  fullName: z.string().min(3),
  position: z.string().min(2),
  baseSalary: z.number().nonnegative(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "INACTIVE"]),
});

export async function updateEmployee(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  try {
    await requireUser();
    const d = updateSchema.parse(input);
    await db.employee.update({
      where: { id: d.id },
      data: { fullName: d.fullName, position: d.position, baseSalary: d.baseSalary, status: d.status },
    });
    revalidatePath("/xodimlar");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
