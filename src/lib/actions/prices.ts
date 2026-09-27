"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { refreshPriceWatch } from "@/lib/price-watch";
import { fail, requireUser, type ActionResult } from "./_shared";

/** Har bir dorixona uchun ustama: yoqilgan/o'chirilgan va foizi */
const settingSchema = z.object({
  unit: z.string().min(2),
  enabled: z.boolean(),
  percent: z.number().min(0).max(100),
});

const watchSchema = z.object({
  name: z.string().min(2, "Dori nomini yozing"),
  sourceUrl: z.string().url("Havola noto'g'ri").optional().or(z.literal("")),
});

function revalidateAll() {
  revalidatePath("/narxlar");
  revalidatePath("/ombor");
}

export async function savePriceSetting(input: z.input<typeof settingSchema>): Promise<ActionResult> {
  try {
    await requireUser();
    const data = settingSchema.parse(input);
    await db.priceSetting.upsert({
      where: { unit: data.unit },
      update: { enabled: data.enabled, percent: data.percent },
      create: { unit: data.unit, enabled: data.enabled, percent: data.percent },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Ro'yxatga yangi dori qo'shish */
export async function addPriceWatch(input: z.input<typeof watchSchema>): Promise<ActionResult> {
  try {
    await requireUser();
    const data = watchSchema.parse(input);
    await db.priceWatch.upsert({
      where: { name: data.name.trim().toUpperCase() },
      update: { sourceUrl: data.sourceUrl || null, active: true },
      create: { name: data.name.trim().toUpperCase(), sourceUrl: data.sourceUrl || null },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Havolani biriktirish yoki almashtirish */
export async function setPriceWatchUrl(id: string, sourceUrl: string): Promise<ActionResult> {
  try {
    await requireUser();
    if (!id) return { ok: false, error: "Yozuv topilmadi" };
    const url = sourceUrl.trim();
    if (url && !/^https:\/\/arzonapteka\.uz\//.test(url)) {
      return { ok: false, error: "arzonapteka.uz havolasi bo'lishi kerak" };
    }
    await db.priceWatch.update({
      where: { id },
      data: { sourceUrl: url || null, checkedAt: null },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Ayrim doriga alohida ustama; bo'sh bo'lsa dorixona sozlamasi ishlatiladi */
export async function setPriceWatchPercent(id: string, percent: number | null): Promise<ActionResult> {
  try {
    await requireUser();
    if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) {
      return { ok: false, error: "Foiz 0 va 100 orasida bo'lishi kerak" };
    }
    await db.priceWatch.update({ where: { id }, data: { percent } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function togglePriceWatch(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireUser();
    await db.priceWatch.update({ where: { id }, data: { active } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Qo'lda yangilash — bir chaqiruvda 12 ta dori */
export async function refreshPricesNow(): Promise<ActionResult> {
  try {
    await requireUser();
    const result = await refreshPriceWatch(12);
    revalidateAll();
    if (!result.ok && result.updated === 0 && result.linked === 0) {
      return { ok: false, error: result.errors[0] ?? "Narx olinmadi" };
    }
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
