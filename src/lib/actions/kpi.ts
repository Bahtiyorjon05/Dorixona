"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { bonusAmount, bonusPercentForScore, computeTotalScore } from "@/lib/kpi";
import { fail, requireUser, type ActionResult } from "./_shared";

const score = z.number().int().min(0).max(100);
const schema = z.object({
  employeeId: z.string(),
  salesScore: score,
  marginScore: score,
  attendanceScore: score,
  disciplineScore: score,
  customerScore: score,
});

/** KPI komponentlarini saqlaydi va yakuniy ball + bonusni qayta hisoblaydi */
export async function saveKpi(input: z.input<typeof schema>): Promise<ActionResult> {
  try {
    await requireUser();
    const d = schema.parse(input);

    const employee = await db.employee.findUnique({ where: { id: d.employeeId } });
    if (!employee) throw new Error("Xodim topilmadi");

    const totalScore = computeTotalScore(d);
    const bonusPercent = bonusPercentForScore(totalScore);
    const amount = bonusAmount(Number(employee.baseSalary), totalScore);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    await db.kpiRecord.upsert({
      where: { employeeId_year_month: { employeeId: d.employeeId, year, month } },
      create: { ...d, year, month, totalScore, bonusPercent, bonusAmount: amount },
      update: { ...d, totalScore, bonusPercent, bonusAmount: amount },
    });

    revalidatePath("/kpi");
    revalidatePath("/xodimlar");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
