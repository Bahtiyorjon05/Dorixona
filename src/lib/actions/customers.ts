"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { makeCardCode } from "@/lib/loyalty";
import { activeBranch, fail, requireUser, type ActionResult } from "./_shared";

const createSchema = z.object({
  fullName: z.string().min(2, "Ism kiriting"),
  phone: z.string().min(7, "Telefon raqamini kiriting"),
  birthday: z.string().optional(),
});

export async function createCustomer(input: z.input<typeof createSchema>): Promise<ActionResult> {
  try {
    await requireUser();
    const d = createSchema.parse(input);
    const branch = await activeBranch();

    const phone = d.phone.startsWith("+") ? d.phone : `+${d.phone.replace(/^\+?/, "")}`;
    const exists = await db.customer.findUnique({ where: { phone } });
    if (exists) throw new Error("Bu telefon raqami allaqachon ro'yxatda bor");

    const count = await db.customer.count();
    await db.customer.create({
      data: {
        fullName: d.fullName,
        phone,
        cardCode: makeCardCode(101 + count),
        birthday: d.birthday ? new Date(d.birthday) : null,
        registeredVia: "manual",
        branchId: branch.id,
      },
    });
    revalidatePath("/mijozlar");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const adjustSchema = z.object({
  customerId: z.string(),
  points: z.number().int(), // musbat yoki manfiy
  note: z.string().optional(),
});

/** Ballarni qo'lda tuzatish (qo'shish yoki ayirish) */
export async function adjustPoints(input: z.input<typeof adjustSchema>): Promise<ActionResult> {
  try {
    await requireUser();
    const d = adjustSchema.parse(input);
    if (d.points === 0) throw new Error("0 ballni o'zgartirib bo'lmaydi");

    const customer = await db.customer.findUnique({ where: { id: d.customerId } });
    if (!customer) throw new Error("Mijoz topilmadi");
    if (customer.points + d.points < 0) throw new Error("Ballar manfiy bo'lib qoladi");

    await db.$transaction([
      db.customer.update({
        where: { id: d.customerId },
        data: { points: { increment: d.points } },
      }),
      db.loyaltyTransaction.create({
        data: {
          customerId: d.customerId,
          type: "ADJUST",
          points: d.points,
          note: d.note || "Qo'lda tuzatish",
        },
      }),
    ]);
    revalidatePath("/mijozlar");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
