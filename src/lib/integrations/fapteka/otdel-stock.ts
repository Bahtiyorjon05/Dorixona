import "server-only";
import { db } from "@/lib/db";
import type { Filial } from "@/lib/filial";
import { otdelUnitMap } from "./otdel";

type Row = Record<string, string>;

const numberValue = (value: unknown) => {
  const n = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export type OtdelStockResult = {
  unit: Filial;
  otdelId: string;
  rows: number;
  stockValue: number;
};

/**
 * SITE.exe push'idagi qoldiqni otdel bo'yicha ajratib, joriy oyning
 * `MonthlyFinance.stockValue` (astatka) maydoniga yozadi.
 *
 * Nega shu yo'l: `Product` jadvalida bitta SKU uchun bitta qator bor
 * (`@@unique([branchId, sku])`), shuning uchun ikki dorixona qoldig'i
 * u yerda qo'shilib ketadi. Bu funksiya esa Product'ga tegmasdan,
 * push paytida otdel kesimida hisoblab qo'yadi.
 *
 * Hisob: SUM(K × P) — miqdor × chakana narx. P chakana narx bo'lgani
 * uchun natija tan narxdagi astatkadan katta chiqadi.
 *
 * FAPTEKA_OTDEL_UNITS sozlanmagan bo'lsa hech narsa qilmaydi.
 */
export async function syncOtdelStockValue(rows: Row[]): Promise<OtdelStockResult[]> {
  const map = otdelUnitMap();
  if (map.size === 0) return [];

  const branch = await db.branch.findFirst({ where: { isActive: true } });
  if (!branch) return [];

  const totals = new Map<string, { unit: Filial; rows: number; value: number }>();
  for (const row of rows) {
    const otdelId = (row.O ?? "").trim();
    const unit = map.get(otdelId);
    if (!unit) continue;

    const quantity = numberValue(row.K ?? row.Q);
    const price = numberValue(row.P);
    if (quantity <= 0) continue;

    const current = totals.get(otdelId) ?? { unit, rows: 0, value: 0 };
    current.rows += 1;
    current.value += quantity * price;
    totals.set(otdelId, current);
  }

  const now = new Date();
  const periodMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  const results: OtdelStockResult[] = [];
  for (const [otdelId, entry] of totals) {
    await db.monthlyFinance.upsert({
      where: { unit_periodMonth: { unit: entry.unit, periodMonth } },
      create: {
        unit: entry.unit,
        periodMonth,
        branchId: branch.id,
        stockValue: entry.value,
      },
      // Faqat astatka yangilanadi — savdo, foyda va pereotsenkaga tegilmaydi
      update: { stockValue: entry.value },
    });
    results.push({ unit: entry.unit, otdelId, rows: entry.rows, stockValue: entry.value });
  }

  return results;
}
