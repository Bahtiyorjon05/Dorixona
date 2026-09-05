"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { activeBranch, fail, requireUser, type ActionResult } from "./_shared";

/** Bo'sh yoki "Umumiy" bo'lsa null saqlaymiz. */
function normalizeUnit(unit?: string) {
  const value = unit?.trim();
  if (!value || value === "Umumiy") return null;
  return value;
}

function revalidateAll() {
  revalidatePath("/xodimlar");
  revalidatePath("/moliya");
  revalidatePath("/kpi");
  revalidatePath("/davomat");
}

const createSchema = z.object({
  fullName: z.string().min(3, "To'liq ism kiriting"),
  position: z.string().min(2, "Lavozim kiriting"),
  phone: z.string().optional(),
  baseSalary: z.number().nonnegative(),
  unit: z.string().optional(),
});

export async function createEmployee(input: z.input<typeof createSchema>): Promise<ActionResult> {
  try {
    await requireUser();
    const d = createSchema.parse(input);
    const branch = await activeBranch();
    await db.employee.create({
      data: {
        fullName: d.fullName.trim(),
        position: d.position.trim(),
        phone: d.phone || null,
        baseSalary: d.baseSalary,
        unit: normalizeUnit(d.unit),
        branchId: branch.id,
      },
    });
    revalidateAll();
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
  unit: z.string().optional(),
});

export async function updateEmployee(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  try {
    await requireUser();
    const d = updateSchema.parse(input);
    await db.employee.update({
      where: { id: d.id },
      data: {
        fullName: d.fullName.trim(),
        position: d.position.trim(),
        baseSalary: d.baseSalary,
        status: d.status,
        unit: normalizeUnit(d.unit),
      },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    await db.employee.delete({ where: { id } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
