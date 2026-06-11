"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { latePenalty } from "@/lib/kpi";
import { fail, requireUser, type ActionResult } from "./_shared";

const WORK_START_HOUR = 9; // ish 09:00 da boshlanadi

const schema = z.object({
  employeeId: z.string(),
  status: z.enum(["PRESENT", "ABSENT", "ON_LEAVE"]),
  checkInTime: z.string().optional(), // "HH:MM"
});

/** Bugungi davomatni belgilash (upsert) */
export async function markAttendance(input: z.input<typeof schema>): Promise<ActionResult> {
  try {
    await requireUser();
    const d = schema.parse(input);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let checkIn: Date | null = null;
    let lateMinutes = 0;
    let penalty = 0;

    if (d.status === "PRESENT") {
      const [h, m] = (d.checkInTime || `${now.getHours()}:${now.getMinutes()}`)
        .split(":")
        .map(Number);
      checkIn = new Date(today);
      checkIn.setHours(h, m, 0, 0);
      const startMin = WORK_START_HOUR * 60;
      const arriveMin = h * 60 + m;
      lateMinutes = Math.max(0, arriveMin - startMin);
      penalty = latePenalty(lateMinutes);
    }

    await db.attendance.upsert({
      where: { employeeId_date: { employeeId: d.employeeId, date: today } },
      create: {
        employeeId: d.employeeId,
        date: today,
        checkIn,
        lateMinutes,
        penalty,
        status: d.status === "PRESENT" && lateMinutes > 5 ? "LATE" : d.status,
      },
      update: {
        checkIn,
        lateMinutes,
        penalty,
        status: d.status === "PRESENT" && lateMinutes > 5 ? "LATE" : d.status,
      },
    });

    revalidatePath("/davomat");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
