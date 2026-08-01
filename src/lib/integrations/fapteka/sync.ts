import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { fetchFaptekaReport, getFaptekaConfig, numberValue, dateValue, type FaptekaRow } from "./client";
import { buildIncomingExpenseEntries } from "./expense-helpers";
import { FAPTEKA_REPORTS, faptekaReceipt, faptekaSku, type FaptekaReportKey } from "./mapping";

export type FaptekaSyncMode = "catalog" | "movements" | "sales" | "all";

export type FaptekaSyncSummary = {
  ok: boolean;
  mode: FaptekaSyncMode;
  dateFrom: string;
  dateTo: string;
  catalogRows: number;
  stockRows: number;
  productsUpserted: number;
  movementRows: number;
  movementsCreated: number;
  expenseRows: number;
  expensesCreated: number;
  saleRows: number;
  salesUpserted: number;
  errors: string[];
};

export type FaptekaSitePushSummary = {
  ok: boolean;
  receivedRows: number;
  productsUpserted: number;
  skippedRows: number;
  errors: string[];
};

type StockInfo = {
  stock: number;
  salePrice: number;
  expiryDate: Date | null;
};
type ProductClient = Pick<typeof db, "product">;

type FaptekaSiteProductInput = {
  name: string;
  sku: string;
  unit: string;
  salePrice: number;
  stock: number;
  branchId: string;
};

function isoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Sana noto'g'ri");
  return date.toISOString().slice(0, 10);
}

function endExclusive(value: string) {
  const date = new Date(value);
  date.setDate(date.getDate() + 1);
  return date;
}

function makeSummary(mode: FaptekaSyncMode, dateFrom: string, dateTo: string): FaptekaSyncSummary {
  return {
    ok: true,
    mode,
    dateFrom,
    dateTo,
    catalogRows: 0,
    stockRows: 0,
    productsUpserted: 0,
    movementRows: 0,
    movementsCreated: 0,
    expenseRows: 0,
    expensesCreated: 0,
    saleRows: 0,
    salesUpserted: 0,
    errors: [],
  };
}

function rowId(row: Record<string, string>, idKey: "I" | "G" = "G") {
  return row[idKey]?.trim();
}

function stockCount(value: unknown) {
  const quantity = numberValue(value);
  if (quantity > 0 && quantity < 1) return 1;
  return Math.max(0, Math.round(quantity));
}

function addError(summary: FaptekaSyncSummary, error: unknown) {
  summary.ok = false;
  summary.errors.push(error instanceof Error ? error.message : "Noma'lum xatolik");
}

function groupStockRows(rows: Record<string, string>[]) {
  const map = new Map<string, StockInfo>();
  for (const row of rows) {
    const id = rowId(row, "G");
    if (!id) continue;
    const existing = map.get(id) ?? { stock: 0, salePrice: 0, expiryDate: null };
    const expiryDate = dateValue(row.E);
    map.set(id, {
      stock: existing.stock + numberValue(row.Q),
      salePrice: Math.max(existing.salePrice, numberValue(row.P)),
      expiryDate:
        expiryDate && (!existing.expiryDate || expiryDate < existing.expiryDate)
          ? expiryDate
          : existing.expiryDate,
    });
  }
  return map;
}

async function syncCatalogAndStock(input: {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  summary: FaptekaSyncSummary;
}) {
  const config = getFaptekaConfig();
  const [catalog, stock] = await Promise.all([
    fetchFaptekaReport({ report: "catalog", dateFrom: input.dateFrom, dateTo: input.dateTo, config }),
    fetchFaptekaReport({ report: "stock", dateFrom: input.dateFrom, dateTo: input.dateTo, config }),
  ]);

  input.summary.catalogRows += catalog.rows.length;
  input.summary.stockRows += stock.rows.length;

  const catalogById = new Map<string, Record<string, string>>();
  for (const row of catalog.rows) {
    const id = rowId(row, "I");
    if (id) catalogById.set(id, row);
  }

  const stockById = groupStockRows(stock.rows);
  const ids = new Set([...catalogById.keys(), ...stockById.keys()]);

  for (const id of ids) {
    const catalogRow = catalogById.get(id);
    const stockInfo = stockById.get(id);
    const sku = faptekaSku(id);
    const existing = await db.product.findUnique({
      where: { branchId_sku: { branchId: input.branchId, sku } },
    });

    const salePrice = stockInfo?.salePrice || Number(existing?.salePrice ?? 0);
    const stock = stockCount(stockInfo?.stock ?? existing?.stock ?? 0);
    const name = catalogRow?.N || existing?.name || `F-Apteka #${id}`;
    const unit = catalogRow?.E || existing?.unit || "dona";

    await db.product.upsert({
      where: { branchId_sku: { branchId: input.branchId, sku } },
      update: {
        name,
        unit,
        category: existing?.category || "F-Apteka",
        salePrice,
        stock,
        expiryDate: stockInfo?.expiryDate ?? existing?.expiryDate ?? null,
        isActive: true,
      },
      create: {
        name,
        sku,
        category: "F-Apteka",
        unit,
        costPrice: 0,
        salePrice,
        stock,
        minStock: 0,
        expiryDate: stockInfo?.expiryDate ?? null,
        branchId: input.branchId,
      },
    });
    input.summary.productsUpserted += 1;
  }
}

async function ensureFaptekaProduct(input: {
  branchId: string;
  faptekaId: string;
  fallbackPrice?: number;
  tx?: ProductClient;
}) {
  const client = input.tx ?? db;
  const sku = faptekaSku(input.faptekaId);
  const existing = await client.product.findUnique({
    where: { branchId_sku: { branchId: input.branchId, sku } },
  });
  if (existing) return existing;

  return client.product.create({
    data: {
      name: `F-Apteka #${input.faptekaId}`,
      sku,
      category: "F-Apteka",
      unit: "dona",
      costPrice: 0,
      salePrice: input.fallbackPrice ?? 0,
      stock: 0,
      minStock: 0,
      branchId: input.branchId,
    },
  });
}

async function syncMovementReport(input: {
  branchId: string;
  report: FaptekaReportKey;
  movementType: "IN" | "OUT" | "ADJUST";
  dateFrom: string;
  dateTo: string;
  summary: FaptekaSyncSummary;
}) {
  const report = FAPTEKA_REPORTS[input.report];
  const response = await fetchFaptekaReport({
    report: input.report,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });
  input.summary.movementRows += response.rows.length;

  await db.stockMovement.deleteMany({
    where: {
      note: { startsWith: `FA:${report.id}:` },
      createdAt: { gte: new Date(input.dateFrom), lt: endExclusive(input.dateTo) },
    },
  });

  for (const row of response.rows) {
    const faptekaId = rowId(row, "G");
    const quantity = stockCount(row.Q);
    if (!faptekaId || quantity <= 0) continue;

    const product = await ensureFaptekaProduct({
      branchId: input.branchId,
      faptekaId,
      fallbackPrice: numberValue(row.P),
    });
    const price = numberValue(row.P);
    if (input.movementType === "IN" && price > 0) {
      await db.product.update({ where: { id: product.id }, data: { costPrice: price } });
    }

    const docId = row.ID || row.N || `${row.D ?? input.dateFrom}-${faptekaId}`;
    await db.stockMovement.create({
      data: {
        productId: product.id,
        type: input.movementType,
        quantity,
        note: `FA:${report.id}:${docId}; series=${row.S ?? "-"}; product=${faptekaId}`,
        createdAt: dateValue(row.D) ?? new Date(input.dateFrom),
      },
    });
    input.summary.movementsCreated += 1;
  }
}

async function syncIncomingExpenses(input: {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  summary: FaptekaSyncSummary;
}) {
  const response = await fetchFaptekaReport({
    report: "incomingV2",
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });
  input.summary.expenseRows += response.rows.length;

  const entries = buildIncomingExpenseEntries(
    response.rows.map((row) => ({
      docId: row.ID || row.N || `${row.D ?? input.dateFrom}-${rowId(row, "G") || ""}`,
      quantity: stockCount(row.Q || 1),
      price: numberValue(row.P),
      spentAt: dateValue(row.D) ?? new Date(input.dateFrom),
    })),
  );

  const from = new Date(input.dateFrom);
  const to = endExclusive(input.dateTo);
  await db.expense.deleteMany({
    where: {
      title: { startsWith: "FA:EXP:" },
      spentAt: { gte: from, lt: to },
    },
  });

  for (const entry of entries) {
    await db.expense.create({
      data: {
        title: `FA:EXP:${entry.docId}`,
        category: "GOODS",
        amount: entry.amount,
        spentAt: entry.spentAt,
        isRecurring: false,
        branchId: input.branchId,
      },
    });
    input.summary.expensesCreated += 1;
  }
}

async function syncMovements(input: {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  summary: FaptekaSyncSummary;
}) {
  await syncIncomingExpenses(input);
  await syncMovementReport({ ...input, report: "incomingV2", movementType: "IN" });
  await syncMovementReport({ ...input, report: "supplierReturnV2", movementType: "OUT" });
  await syncMovementReport({ ...input, report: "writeOff", movementType: "ADJUST" });
}

function saleLineTotal(row: Record<string, string>, quantity: number, fallbackPrice: number) {
  const withoutVat = numberValue(row.SP);
  const vat = numberValue(row.SN);
  if (withoutVat || vat) return withoutVat + vat;
  const rowPrice = numberValue(row.P, fallbackPrice);
  return rowPrice * quantity;
}

async function syncSalesReport(input: {
  branchId: string;
  report: FaptekaReportKey;
  receiptPrefix: string;
  dateFrom: string;
  dateTo: string;
  summary: FaptekaSyncSummary;
}) {
  const response = await fetchFaptekaReport({
    report: input.report,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });
  input.summary.saleRows += response.rows.length;

  const groups = new Map<string, Record<string, string>[]>();
  for (const row of response.rows) {
    const faptekaId = rowId(row, "G");
    if (!faptekaId) continue;
    const docId = row.ID || `${row.D ?? input.dateFrom}-${faptekaId}-${row.S ?? ""}`;
    const group = groups.get(docId) ?? [];
    group.push(row);
    groups.set(docId, group);
  }

  for (const [docId, rows] of groups) {
    await db.$transaction(async (tx) => {
      const saleItemsData: {
        productId: string;
        quantity: number;
        unitPrice: number;
        costPrice: number;
        lineTotal: number;
      }[] = [];

      for (const row of rows) {
        const faptekaId = rowId(row, "G");
        if (!faptekaId) continue;
        const quantity = Math.max(1, stockCount(row.Q || 1));
        const fallbackPrice = numberValue(row.P);
        const product = await ensureFaptekaProduct({
          branchId: input.branchId,
          faptekaId,
          fallbackPrice,
          tx,
        });
        const lineTotal = saleLineTotal(row, quantity, Number(product.salePrice ?? fallbackPrice));
        saleItemsData.push({
          productId: product.id,
          quantity,
          unitPrice: lineTotal / quantity,
          costPrice: Number(product.costPrice ?? 0),
          lineTotal,
        });
      }

      if (!saleItemsData.length) return;
      const receiptNo = faptekaReceipt(docId, input.receiptPrefix);
      const total = saleItemsData.reduce((sum, item) => sum + item.lineTotal, 0);
      const createdAt = dateValue(rows[0]?.D) ?? new Date(input.dateFrom);

      const existing = await tx.sale.findUnique({ where: { receiptNo } });
      if (existing) {
        await tx.saleItem.deleteMany({ where: { saleId: existing.id } });
        await tx.sale.update({
          where: { id: existing.id },
          data: { total, discount: 0, pointsEarned: 0, pointsRedeemed: 0, createdAt },
        });
        await tx.saleItem.createMany({
          data: saleItemsData.map((item) => ({ ...item, saleId: existing.id })),
        });
      } else {
        await tx.sale.create({
          data: {
            receiptNo,
            total,
            discount: 0,
            pointsEarned: 0,
            pointsRedeemed: 0,
            paymentMethod: "CASH",
            branchId: input.branchId,
            createdAt,
            items: { create: saleItemsData },
          },
        });
      }
    });
    input.summary.salesUpserted += 1;
  }
}

async function syncSales(input: {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  summary: FaptekaSyncSummary;
}) {
  await syncSalesReport({ ...input, report: "retailSaleV2", receiptPrefix: "FA-" });
  await syncSalesReport({ ...input, report: "insuranceSaleV2", receiptPrefix: "FA-INS-" });
}

export async function syncFapteka(input: {
  mode: FaptekaSyncMode;
  dateFrom: string;
  dateTo: string;
}): Promise<FaptekaSyncSummary> {
  const dateFrom = isoDate(input.dateFrom);
  const dateTo = isoDate(input.dateTo);
  const summary = makeSummary(input.mode, dateFrom, dateTo);

  const branch = await db.branch.findFirst({ where: { isActive: true } });
  if (!branch) throw new Error("Aktiv filial topilmadi");

  try {
    if (input.mode === "catalog" || input.mode === "all") {
      await syncCatalogAndStock({ branchId: branch.id, dateFrom, dateTo, summary });
    }
  } catch (error) {
    addError(summary, error);
  }

  try {
    if (input.mode === "movements" || input.mode === "all") {
      await syncMovements({ branchId: branch.id, dateFrom, dateTo, summary });
    }
  } catch (error) {
    addError(summary, error);
  }

  try {
    if (input.mode === "sales" || input.mode === "all") {
      await syncSales({ branchId: branch.id, dateFrom, dateTo, summary });
    }
  } catch (error) {
    addError(summary, error);
  }

  return summary;
}

export async function syncFaptekaSiteRows(rows: FaptekaRow[]): Promise<FaptekaSitePushSummary> {
  const summary: FaptekaSitePushSummary = {
    ok: true,
    receivedRows: rows.length,
    productsUpserted: 0,
    skippedRows: 0,
    errors: [],
  };

  const branch = await db.branch.findFirst({ where: { isActive: true } });
  if (!branch) throw new Error("Aktiv filial topilmadi");

  const productsBySku = new Map<string, FaptekaSiteProductInput & { rawStock: number }>();
  for (const row of rows) {
    const id = rowId(row, "I") || rowId(row, "G");
    if (!id) {
      summary.skippedRows += 1;
      continue;
    }

    const sku = faptekaSku(id);
    const existing = productsBySku.get(sku);
    const rawStock = numberValue(row.K ?? row.Q);
    productsBySku.set(sku, {
      name: row.N || existing?.name || `F-Apteka #${id}`,
      sku,
      unit: row.UN || row.E || existing?.unit || "dona",
      salePrice: Math.max(existing?.salePrice ?? 0, numberValue(row.P)),
      stock: 0,
      rawStock: (existing?.rawStock ?? 0) + rawStock,
      branchId: branch.id,
    });
  }

  const products = [...productsBySku.values()].map(({ rawStock, ...product }) => ({
    ...product,
    stock: stockCount(rawStock),
  }));

  for (let index = 0; index < products.length; index += 500) {
    const chunk = products.slice(index, index + 500);
    try {
      await db.$executeRaw(Prisma.sql`
        INSERT INTO "Product" (
          "id", "name", "sku", "category", "unit", "costPrice", "salePrice", "stock",
          "minStock", "isActive", "branchId", "createdAt", "updatedAt"
        )
        VALUES ${Prisma.join(
          chunk.map((product) => Prisma.sql`(
            ${randomUUID()}, ${product.name}, ${product.sku}, ${"F-Apteka"}, ${product.unit},
            ${0}, ${product.salePrice}, ${product.stock}, ${0}, ${true}, ${product.branchId}, NOW(), NOW()
          )`),
        )}
        ON CONFLICT ("branchId", "sku") DO UPDATE SET
          "name" = EXCLUDED."name",
          "unit" = EXCLUDED."unit",
          "salePrice" = EXCLUDED."salePrice",
          "stock" = EXCLUDED."stock",
          "isActive" = true,
          "updatedAt" = NOW()
      `);
      summary.productsUpserted += chunk.length;
    } catch (error) {
      summary.ok = false;
      summary.errors.push(error instanceof Error ? error.message : "F-Apteka mahsulotlari batch saqlanmadi");
    }
  }

  return summary;
}
