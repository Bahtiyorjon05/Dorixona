import "server-only";
import { db } from "@/lib/db";
import { otdelUnitMap } from "@/lib/integrations/fapteka/otdel";

/**
 * Dorixona bo'yicha qoldiq — SITE.exe har 5 daqiqada har otdel × dori uchun
 * qoldiq (K) yuboradi va u FaptekaPrice jadvalida turadi (pereotsenka
 * hisobi uchun yuritiladi). Product jadvalida esa bitta SKU = bitta qator,
 * ikki dorixona qoldig'i qo'shilib ketadi — dorixona kesimi shu yerdan.
 *
 * Natija: "FA:<fid>" -> { Yunusobod: 2.5, Shayxontohur: 4 }
 */
export async function getStockByUnit() {
  const units = otdelUnitMap();
  try {
    const rows = await db.faptekaPrice.findMany({ select: { otdel: true, fid: true, qty: true } });
    const bySku = new Map<string, Record<string, number>>();
    for (const row of rows) {
      const unit = units.get(row.otdel);
      if (!unit) continue;
      const sku = `FA:${row.fid}`;
      const entry = bySku.get(sku) ?? {};
      entry[unit] = (entry[unit] ?? 0) + Math.round(Number(row.qty) * 100) / 100;
      bySku.set(sku, entry);
    }
    return { known: rows.length > 0, units: [...new Set(units.values())], bySku };
  } catch {
    return { known: false, units: [] as string[], bySku: new Map<string, Record<string, number>>() };
  }
}
