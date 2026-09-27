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

/**
 * Doriga arzonapteka.uz havolasini biriktirish.
 *
 * Havola bor doriga tavsiya narx raqobatchining eng arzon narxidan,
 * havolasiz doriga esa tan narxdan hisoblanadi.
 */
export async function setPriceWatchUrl(input: {
  watchId?: string | null;
  sku?: string | null;
  name: string;
  sourceUrl: string;
}): Promise<ActionResult> {
  try {
    await requireUser();
    const url = input.sourceUrl.trim();
    if (url && !/^https:\/\/arzonapteka\.uz\//.test(url)) {
      return { ok: false, error: "arzonapteka.uz havolasi bo'lishi kerak" };
    }

    if (input.watchId) {
      // Havola o'zgardi — eski narx endi yaramaydi, qayta tekshiriladi
      await db.priceWatch.update({
        where: { id: input.watchId },
        data: { sourceUrl: url || null, competitorPrice: url ? null : undefined, checkedAt: null },
      });
    } else {
      if (!url) return { ok: true };
      const name = input.name.trim().toUpperCase();
      await db.priceWatch.upsert({
        where: { name },
        update: { sourceUrl: url, sku: input.sku ?? undefined, active: true, checkedAt: null },
        create: { name, sku: input.sku ?? null, sourceUrl: url },
      });
    }

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Bitta doriga ustama foizi.
 *
 * Narx sozlamasi `PriceWatch` da saqlanadi. arzonapteka.uz da kuzatilmagan
 * doriga sozlama qatori hali bo'lmaydi — birinchi marta foiz qo'yilganda
 * o'sha dori uchun qator yaratiladi (havolasiz, faqat foiz uchun).
 */
export async function setDrugPercent(input: {
  watchId?: string | null;
  sku?: string | null;
  name: string;
  percent: number | null;
}): Promise<ActionResult> {
  try {
    await requireUser();
    const { percent } = input;
    if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 1000)) {
      return { ok: false, error: "Foiz 0 va 1000 orasida bo'lishi kerak" };
    }

    if (input.watchId) {
      await db.priceWatch.update({ where: { id: input.watchId }, data: { percent } });
    } else {
      if (percent === null) return { ok: true }; // o'chiradigan narsa yo'q
      const name = input.name.trim().toUpperCase();
      await db.priceWatch.upsert({
        where: { name },
        update: { percent, sku: input.sku ?? undefined, active: true },
        create: { name, sku: input.sku ?? null, percent },
      });
    }

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
