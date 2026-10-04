import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { otdelUnitMap } from "@/lib/integrations/fapteka/otdel";

/**
 * Yetkazib beruvchilar — F-Apteka kirim qatorlaridan (INCOMELN.ORG).
 *
 *  - goodSuppliers: har tovarning oxirgi yetkazib beruvchisi ->
 *    Product."supplierOrg" (qoldiq yetkazib beruvchi bo'yicha). Ustun
 *    Prisma sxemasida yo'q (prisma/manual/yetkazib-beruvchi.sql).
 *  - supplierSales: oylik savdo yetkazib beruvchi bo'yicha — har chek qatori
 *    qaysi kirim partiyasidan sotilgani aniq (INVOICELN.INCOMELN). DailySales
 *    ga oy boshi kuni, docType "SUP:<org>" bilan yoziladi (amount = savdo,
 *    cost = tan narx). Boshqa hisoblar aniq turlar bo'yicha filtrlanadi,
 *    shuning uchun bu qatorlar savdoga aralashmaydi.
 */

type Row = Record<string, string | undefined>;

const toNumber = (value: unknown) => {
  const n = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const SUPPLIER_DOC_PREFIX = "SUP:";

export async function syncGoodSuppliers(rows: Row[]) {
  const pairs = rows
    .map((row) => ({ sku: `FA:${String(row.G ?? "").trim()}`, org: String(row.O ?? "").trim() }))
    .filter((pair) => pair.sku !== "FA:" && pair.org);
  let updated = 0;
  for (let index = 0; index < pairs.length; index += 500) {
    const chunk = pairs.slice(index, index + 500);
    updated += await db.$executeRaw`
      UPDATE "Product" p SET "supplierOrg" = v.org
      FROM (VALUES ${Prisma.join(chunk.map((pair) => Prisma.sql`(${pair.sku}, ${pair.org})`))}) AS v(sku, org)
      WHERE p.sku = v.sku AND p."supplierOrg" IS DISTINCT FROM v.org`;
  }
  return { received: pairs.length, updated };
}

export async function syncSupplierSales(input: { rows: Row[]; dateFrom: string; dateTo: string }) {
  const units = otdelUnitMap();
  const from = new Date(`${input.dateFrom.slice(0, 7)}-01T00:00:00Z`);
  const toStart = new Date(`${input.dateTo.slice(0, 7)}-01T00:00:00Z`);
  const to = new Date(Date.UTC(toStart.getUTCFullYear(), toStart.getUTCMonth() + 1, 1));

  const data = new Map<string, { day: Date; unit: string; docType: string; amount: number; cost: number }>();
  let skipped = 0;
  for (const row of input.rows) {
    const unit = units.get(String(row.OTD ?? "").trim());
    const month = String(row.M ?? "");
    if (!unit || !/^\d{4}-\d{2}$/.test(month)) {
      skipped += 1;
      continue;
    }
    const docType = `${SUPPLIER_DOC_PREFIX}${String(row.O ?? "").trim() || "0"}`;
    const key = `${month}|${unit}|${docType}`;
    const entry = data.get(key) ?? { day: new Date(`${month}-01T00:00:00Z`), unit, docType, amount: 0, cost: 0 };
    entry.amount += toNumber(row.S);
    entry.cost += toNumber(row.C);
    data.set(key, entry);
  }

  await db.$transaction([
    db.dailySales.deleteMany({
      where: {
        docType: { startsWith: SUPPLIER_DOC_PREFIX },
        unit: { in: [...new Set(units.values())] },
        day: { gte: from, lt: to },
      },
    }),
    db.dailySales.createMany({
      data: [...data.values()].map((e) => ({
        ...e,
        amount: Math.round(e.amount * 100) / 100,
        cost: Math.round(e.cost * 100) / 100,
      })),
    }),
  ]);
  return { saved: data.size, skipped };
}
