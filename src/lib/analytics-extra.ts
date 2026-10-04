import "server-only";
import { db } from "@/lib/db";

/**
 * Analitika: avval "kutilyapti" turgan hisobotlar uchun ma'lumot.
 *
 *  - To'lov usullari — 30-hisobot (PAYIN), DailySales "PAY:<kassa>"
 *  - Cheklar — kassir smenalaridan (CashierShift), kun × dorixona
 *  - Guruhlar — tovar toifasi bo'yicha savdo (cheklar, SaleItem)
 *  - Yetkazib beruvchilar kirimi — F-Apteka kirim harajatlari sarlavhasidan
 *    ("Tovar xaridi: ... — OOO FARM (F-Apteka #1107)")
 */

/** Kassa raqami -> nomi (30-hisobot bilan solishtirib aniqlangan, queries.ts dagi kabi) */
const CASHBOX: Record<string, string> = { "1": "Naqd", "2": "HUMO", "6": "UzCard" };

export type PaymentRow = { day: string; unit: string; method: string; amount: number };
export type CheckRow = { day: string; unit: string; checks: number; net: number };
export type GroupRow = { name: string; qty: number; turnover: number };
export type SupplierRow = { name: string; amount: number; docs: number };

const SUPPLIER_RE = / — (.+?) \(F-Apteka #/;

export async function getAnalyticsExtra(year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const localStart = new Date(year, 0, 1);
  const localEnd = new Date(year + 1, 0, 1);

  const [payRows, shiftRows, groupRows, goodsRows] = await Promise.all([
    db.dailySales
      .findMany({
        where: { day: { gte: start, lt: end }, docType: { startsWith: "PAY:" } },
        select: { day: true, unit: true, docType: true, amount: true },
      })
      .catch(() => []),
    db.cashierShift
      .findMany({
        where: { day: { gte: start, lt: end } },
        select: { day: true, unit: true, checks: true, sales: true, returns: true },
      })
      .catch(() => []),
    db.$queryRaw<{ name: string; qty: number; turnover: number }[]>`
      SELECT COALESCE(NULLIF(p.category, ''), 'Boshqa') AS name,
             SUM(si.quantity)::float8 AS qty,
             SUM(si."lineTotal")::float8 AS turnover
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      JOIN "Product" p ON p.id = si."productId"
      WHERE s."createdAt" >= ${localStart} AND s."createdAt" < ${localEnd}
      GROUP BY 1 ORDER BY 3 DESC`.catch(() => []),
    db.expense
      .findMany({
        where: { category: "GOODS", spentAt: { gte: localStart, lt: localEnd }, title: { contains: "(F-Apteka #" } },
        select: { title: true, amount: true },
      })
      .catch(() => []),
  ]);

  const payments: PaymentRow[] = payRows
    .map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      unit: row.unit,
      method: CASHBOX[row.docType.slice(4)] ?? `Kassa ${row.docType.slice(4)}`,
      amount: Number(row.amount),
    }))
    .filter((row) => row.amount !== 0);

  const checkMap = new Map<string, CheckRow>();
  for (const row of shiftRows) {
    const day = row.day.toISOString().slice(0, 10);
    const key = `${day}|${row.unit}`;
    const entry = checkMap.get(key) ?? { day, unit: row.unit, checks: 0, net: 0 };
    entry.checks += row.checks;
    entry.net += Number(row.sales) - Number(row.returns);
    checkMap.set(key, entry);
  }

  const supplierMap = new Map<string, SupplierRow>();
  for (const row of goodsRows) {
    const name = SUPPLIER_RE.exec(row.title)?.[1]?.trim() || "Noma'lum yetkazib beruvchi";
    const entry = supplierMap.get(name) ?? { name, amount: 0, docs: 0 };
    entry.amount += Number(row.amount);
    entry.docs += 1;
    supplierMap.set(name, entry);
  }

  return {
    payments,
    checks: [...checkMap.values()].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.unit.localeCompare(b.unit))),
    groups: groupRows.map((row) => ({ name: row.name, qty: Math.round(row.qty), turnover: row.turnover })),
    suppliers: [...supplierMap.values()].sort((a, b) => b.amount - a.amount),
  };
}
