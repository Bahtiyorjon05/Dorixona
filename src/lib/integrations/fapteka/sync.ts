import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { fetchFaptekaReport, getFaptekaConfig, numberValue, dateValue, type FaptekaRow } from "./client";
import type { Filial } from "@/lib/filial";
import { categoryFromName, FAPTEKA_DEFAULT_CATEGORY } from "./category";
import { buildIncomingExpenseEntries } from "./expense-helpers";
import {
  FAPTEKA_EXPENSE_PREFIX,
  FAPTEKA_EXPENSE_PREFIX_OLD,
  FAPTEKA_REPORTS,
  faptekaExpenseTitle,
  faptekaReceipt,
  faptekaSku,
  type FaptekaReportKey,
} from "./mapping";
import { otdelUnitMap } from "./otdel";

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

/**
 * Hisobot qatorlari qayerdan olinadi:
 * - pull: Vercel o'zi F-Apteka API'sidan so'raydi (API internetda bo'lsa)
 * - push: dorixona kompyuteridagi ko'prik skript API'dan olib, bizga yuboradi
 */
type ReportSource = (report: FaptekaReportKey) => Promise<FaptekaRow[]>;

/** Push paytida qaysi filial (otdel) ma'lumoti kelgani */
type PushScope = { filialId: string; unit: Filial | null };

type StepInput = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  summary: FaptekaSyncSummary;
  source: ReportSource;
  scope?: PushScope;
};

function pullSource(dateFrom: string, dateTo: string): ReportSource {
  return async (report) => (await fetchFaptekaReport({ report, dateFrom, dateTo })).rows;
}

/**
 * Qatorlardagi F-Apteka tovarlarini bitta so'rovda topadi, yo'qlarini
 * yaratadi. Har qator uchun alohida so'rov yuborilsa, bir kunlik savdo
 * Vercel'ning 60 soniyasiga sig'masdi.
 */
async function loadFaptekaProducts(branchId: string, rows: FaptekaRow[]) {
  const prices = new Map<string, number>();
  for (const row of rows) {
    const id = rowId(row, "G");
    if (id && !prices.has(id)) prices.set(id, numberValue(row.P));
  }
  const skus = [...prices.keys()].map(faptekaSku);
  if (!skus.length) return new Map<string, { id: string; salePrice: Prisma.Decimal; costPrice: Prisma.Decimal }>();

  const find = () =>
    db.product.findMany({
      where: { branchId, sku: { in: skus } },
      select: { id: true, sku: true, salePrice: true, costPrice: true },
    });

  let products = await find();
  const have = new Set(products.map((product) => product.sku));
  const missing = [...prices.entries()].filter(([id]) => !have.has(faptekaSku(id)));
  if (missing.length) {
    await db.product.createMany({
      data: missing.map(([id, price]) => ({
        name: `F-Apteka #${id}`,
        sku: faptekaSku(id),
        category: FAPTEKA_DEFAULT_CATEGORY,
        unit: "dona",
        costPrice: 0,
        salePrice: price,
        stock: 0,
        minStock: 0,
        branchId,
      })),
      skipDuplicates: true,
    });
    products = await find();
  }

  return new Map(products.map(({ sku, ...product }) => [sku, product]));
}

async function syncMovementReport(
  input: StepInput & { report: FaptekaReportKey; movementType: "IN" | "OUT" | "ADJUST" },
) {
  const report = FAPTEKA_REPORTS[input.report];
  const rows = await input.source(input.report);
  input.summary.movementRows += rows.length;

  // Filial bo'yicha push'da har filial faqat o'z yozuvlarini almashtiradi
  const notePrefix = input.scope
    ? `FA:${report.id}:F${input.scope.filialId}:`
    : `FA:${report.id}:`;
  const products = await loadFaptekaProducts(input.branchId, rows);

  const data: Prisma.StockMovementCreateManyInput[] = [];
  const costUpdates = new Map<string, number>();
  for (const row of rows) {
    const faptekaId = rowId(row, "G");
    const quantity = stockCount(row.Q);
    const product = faptekaId ? products.get(faptekaSku(faptekaId)) : undefined;
    if (!faptekaId || !product || quantity <= 0) continue;

    const cost = costPerUnit(row);
    if (input.movementType === "IN" && cost > 0) costUpdates.set(product.id, cost);

    const docId = row.ID || row.N || `${row.D ?? input.dateFrom}-${faptekaId}`;
    data.push({
      productId: product.id,
      type: input.movementType,
      quantity,
      note: `${notePrefix}${docId}; series=${row.S ?? "-"}; product=${faptekaId}`,
      createdAt: dateValue(row.D) ?? new Date(input.dateFrom),
    });
  }

  await db.$transaction([
    db.stockMovement.deleteMany({
      where: {
        note: { startsWith: notePrefix },
        createdAt: { gte: new Date(input.dateFrom), lt: endExclusive(input.dateTo) },
      },
    }),
    db.stockMovement.createMany({ data }),
  ]);
  input.summary.movementsCreated += data.length;

  const updates = [...costUpdates.entries()];
  for (let index = 0; index < updates.length; index += 25) {
    await Promise.all(
      updates
        .slice(index, index + 25)
        .map(([id, costPrice]) => db.product.update({ where: { id }, data: { costPrice } })),
    );
  }
}

/**
 * Kirim qatorlaridagi "I" (1-hisobotda INN, 11-hisobotda kontragent ID)
 * bo'yicha tashkilot nomlarini topadi. Ro'yxat 189-hisobotdan to'ladi.
 */
async function supplierNames(rows: FaptekaRow[]) {
  const keys = [...new Set(rows.map((row) => (row.I ?? "").trim()).filter(Boolean))];
  if (!keys.length) return new Map<string, string>();

  const orgs = await db.faptekaOrg.findMany({
    where: { OR: [{ id: { in: keys } }, { inn: { in: keys } }] },
    select: { id: true, inn: true, name: true },
  });

  const map = new Map<string, string>();
  for (const org of orgs) {
    map.set(org.id, org.name);
    if (org.inn) map.set(org.inn, org.name);
  }
  return map;
}

async function syncIncomingExpenses(input: StepInput & { report: FaptekaReportKey }) {
  const rows = await input.source(input.report);
  input.summary.expenseRows += rows.length;

  const suppliers = await supplierNames(rows);
  const entries = buildIncomingExpenseEntries(
    rows.map((row) => ({
      docId: row.ID || row.N || `${row.D ?? input.dateFrom}-${rowId(row, "G") || ""}`,
      quantity: stockCount(row.Q || 1),
      price: costPerUnit(row),
      spentAt: dateValue(row.D) ?? new Date(input.dateFrom),
      supplier: suppliers.get((row.I ?? "").trim()),
    })),
  );

  // Eski ko'rinishdagi yozuvlar ham tozalansin, aks holda nom o'zgargach
  // bir xil kirim ikki marta turib qolardi.
  const titleFilters = [
    { title: { startsWith: FAPTEKA_EXPENSE_PREFIX } },
    { title: { startsWith: FAPTEKA_EXPENSE_PREFIX_OLD } },
  ];
  await db.$transaction([
    db.expense.deleteMany({
      where: {
        OR: titleFilters,
        spentAt: { gte: new Date(input.dateFrom), lt: endExclusive(input.dateTo) },
      },
    }),
    db.expense.createMany({
      data: entries.map((entry) => ({
        title: faptekaExpenseTitle(entry.docId, entry.supplier),
        category: "GOODS" as const,
        amount: entry.amount,
        spentAt: entry.spentAt,
        isRecurring: false,
        unit: input.scope?.unit ?? null,
        branchId: input.branchId,
      })),
    }),
  ]);
  input.summary.expensesCreated += entries.length;
}

async function syncMovements(input: StepInput) {
  await syncIncomingExpenses({ ...input, report: "incomingV2" });
  await syncMovementReport({ ...input, report: "incomingV2", movementType: "IN" });
  await syncMovementReport({ ...input, report: "supplierReturnV2", movementType: "OUT" });
  await syncMovementReport({ ...input, report: "writeOff", movementType: "ADJUST" });
}

/**
 * Bir dona tovarning tan narxi, QQS bilan: (SP + SN) / Q.
 * Savdo summasi ham QQS bilan keladi, shuning uchun taqqoslash bir xil
 * bo'lishi kerak. SP/SN bo'lmasa, P (QQSsiz narx) ishlatiladi.
 */
function costPerUnit(row: FaptekaRow) {
  const quantity = numberValue(row.Q);
  const withVat = numberValue(row.SP) + numberValue(row.SN);
  if (quantity > 0 && withVat > 0) return withVat / quantity;
  return numberValue(row.P);
}

function saleLineTotal(row: Record<string, string>, quantity: number, fallbackPrice: number) {
  const withoutVat = numberValue(row.SP);
  const vat = numberValue(row.SN);
  if (withoutVat || vat) return withoutVat + vat;
  const rowPrice = numberValue(row.P, fallbackPrice);
  return rowPrice * quantity;
}

async function syncSalesReport(input: StepInput & { report: FaptekaReportKey; receiptPrefix: string }) {
  const rows = await input.source(input.report);
  input.summary.saleRows += rows.length;

  const groups = new Map<string, FaptekaRow[]>();
  for (const row of rows) {
    const faptekaId = rowId(row, "G");
    if (!faptekaId) continue;
    const docId = row.ID || `${row.D ?? input.dateFrom}-${faptekaId}-${row.S ?? ""}`;
    const group = groups.get(docId) ?? [];
    group.push(row);
    groups.set(docId, group);
  }
  if (!groups.size) return;

  // Filial bo'yicha push'da chek raqamiga filial qo'shiladi: FA-2-123
  const receiptPrefix = input.scope
    ? `${input.receiptPrefix}${input.scope.filialId}-`
    : input.receiptPrefix;
  const products = await loadFaptekaProducts(input.branchId, rows);

  const sales: Prisma.SaleCreateManyInput[] = [];
  const items: Prisma.SaleItemCreateManyInput[] = [];
  for (const [docId, groupRows] of groups) {
    const saleId = randomUUID();
    const lines: Prisma.SaleItemCreateManyInput[] = [];
    for (const row of groupRows) {
      const product = products.get(faptekaSku(rowId(row, "G")));
      if (!product) continue;
      const quantity = Math.max(1, stockCount(row.Q || 1));
      const lineTotal = saleLineTotal(row, quantity, Number(product.salePrice ?? numberValue(row.P)));
      lines.push({
        saleId,
        productId: product.id,
        quantity,
        unitPrice: lineTotal / quantity,
        costPrice: Number(product.costPrice ?? 0),
        lineTotal,
      });
    }
    if (!lines.length) continue;

    sales.push({
      id: saleId,
      receiptNo: faptekaReceipt(docId, receiptPrefix),
      total: lines.reduce((sum, line) => sum + Number(line.lineTotal), 0),
      discount: 0,
      pointsEarned: 0,
      pointsRedeemed: 0,
      paymentMethod: "CASH",
      unit: input.scope?.unit ?? null,
      branchId: input.branchId,
      createdAt: dateValue(groupRows[0]?.D) ?? new Date(input.dateFrom),
    });
    items.push(...lines);
  }

  // Har push bugun va kechani qayta yuboradi — cheklarni o'chirib qayta
  // yozamiz (bandlari cascade bilan o'chadi). Takror chek paydo bo'lmaydi.
  await db.$transaction([
    db.sale.deleteMany({ where: { receiptNo: { in: sales.map((sale) => sale.receiptNo) } } }),
    db.sale.createMany({ data: sales }),
    db.saleItem.createMany({ data: items }),
  ]);
  input.summary.salesUpserted += sales.length;
}

async function syncSales(input: StepInput) {
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
  const source = pullSource(dateFrom, dateTo);

  try {
    if (input.mode === "catalog" || input.mode === "all") {
      await syncCatalogAndStock({ branchId: branch.id, dateFrom, dateTo, summary });
    }
  } catch (error) {
    addError(summary, error);
  }

  try {
    if (input.mode === "movements" || input.mode === "all") {
      await syncMovements({ branchId: branch.id, dateFrom, dateTo, summary, source });
    }
  } catch (error) {
    addError(summary, error);
  }

  try {
    if (input.mode === "sales" || input.mode === "all") {
      await syncSales({ branchId: branch.id, dateFrom, dateTo, summary, source });
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
            ${randomUUID()}, ${product.name}, ${product.sku}, ${categoryFromName(product.name)}, ${product.unit},
            ${0}, ${product.salePrice}, ${product.stock}, ${0}, ${true}, ${product.branchId}, NOW(), NOW()
          )`),
        )}
        ON CONFLICT ("branchId", "sku") DO UPDATE SET
          "name" = EXCLUDED."name",
          -- Toifani faqat kod qo'ygan bo'lsa yangilaymiz: odam o'zgartirgan
          -- toifaga tegmaymiz
          "category" = CASE
            WHEN "Product"."category" IS NULL OR "Product"."category" = '' OR "Product"."category" = 'F-Apteka'
              THEN EXCLUDED."category"
            ELSE "Product"."category"
          END,
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

/**
 * F-Apteka tashkilotlari (189-hisobot): yetkazib beruvchi, filial,
 * sug'urta kompaniyasi. Kirim harajatida nomni yozish uchun kerak.
 */
export async function syncFaptekaOrganizations(rows: FaptekaRow[]) {
  let saved = 0;
  for (const row of rows) {
    const id = (row.I ?? "").trim();
    const name = (row.N ?? "").trim();
    if (!id || !name) continue;
    const data = {
      name,
      inn: (row.INN ?? "").trim() || null,
      isSupplier: (row.INC ?? "") === "1",
    };
    try {
      await db.faptekaOrg.upsert({ where: { id }, update: data, create: { id, ...data } });
      saved += 1;
    } catch {
      // Bitta yozuv tushmasa ham qolganlari saqlansin
    }
  }
  return { ok: true, receivedRows: rows.length, saved };
}

/**
 * Kirim hisobotidan faqat tan narxni oladi: harajat ham, ombor harakati ham
 * yozilmaydi. Eski kirimlarni ortga qarab tortib, foyda hisobini to'g'rilash
 * uchun - aks holda o'tgan oylarga qayta harajat yozilib ketardi.
 */
export async function syncFaptekaCostPrices(rows: FaptekaRow[]) {
  const branch = await db.branch.findFirst({ where: { isActive: true } });
  if (!branch) throw new Error("Aktiv filial topilmadi");

  const products = await loadFaptekaProducts(branch.id, rows);
  const costs = new Map<string, number>();
  for (const row of rows) {
    const faptekaId = rowId(row, "G");
    const product = faptekaId ? products.get(faptekaSku(faptekaId)) : undefined;
    const cost = costPerUnit(row);
    // Bir tovar bir necha marta kelgan bo'lsa, oxirgi narx qoladi
    if (product && cost > 0) costs.set(product.id, cost);
  }

  const updates = [...costs.entries()];
  for (let index = 0; index < updates.length; index += 25) {
    await Promise.all(
      updates
        .slice(index, index + 25)
        .map(([id, costPrice]) => db.product.update({ where: { id }, data: { costPrice } })),
    );
  }
  return { ok: true, receivedRows: rows.length, productsUpdated: updates.length };
}

/**
 * Ko'prik skript yuboradigan hisobotlar (savdo va tovar harakati).
 *
 * Dorixonadagi API'da Ver.2 hisobotlari (14, 15, 11, 12) bo'sh qaytaradi —
 * faqat eski raqamlar (4, 5, 1, 2, 3) ma'lumot beradi. Ikkalasi ham qabul
 * qilinadi: API yangilansa, skriptdagi ro'yxatni almashtirish kifoya.
 * Bitta xil ma'lumotni ikkala raqamda yubormang — savdo ikki marta yozilmasin.
 */
export const FAPTEKA_PUSH_REPORTS = [
  "retailSale",
  "retailSaleV2",
  "insuranceSale",
  "insuranceSaleV2",
  "incoming",
  "incomingV2",
  "supplierReturn",
  "supplierReturnV2",
  "writeOff",
  "organizations",
] as const;
export type FaptekaPushReport = (typeof FAPTEKA_PUSH_REPORTS)[number];

export function isFaptekaPushReport(value: unknown): value is FaptekaPushReport {
  return (FAPTEKA_PUSH_REPORTS as readonly unknown[]).includes(value);
}

/**
 * Dorixona kompyuteridagi ko'prik skript yuborgan bitta hisobotni yozadi.
 * Bitta so'rov = bitta hisobot × bitta filial × sana oralig'i.
 */
export async function syncFaptekaPushedReport(input: {
  report: FaptekaPushReport;
  rows: FaptekaRow[];
  filialId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<FaptekaSyncSummary> {
  const dateFrom = isoDate(input.dateFrom);
  const dateTo = isoDate(input.dateTo);
  const isSale = input.report.startsWith("retailSale") || input.report.startsWith("insuranceSale");
  const summary = makeSummary(isSale ? "sales" : "movements", dateFrom, dateTo);

  const branch = await db.branch.findFirst({ where: { isActive: true } });
  if (!branch) throw new Error("Aktiv filial topilmadi");

  const step: StepInput = {
    branchId: branch.id,
    dateFrom,
    dateTo,
    summary,
    source: async () => input.rows,
    scope: { filialId: input.filialId, unit: otdelUnitMap().get(input.filialId) ?? null },
  };

  try {
    switch (input.report) {
      case "retailSale":
      case "retailSaleV2":
        await syncSalesReport({ ...step, report: input.report, receiptPrefix: "FA-" });
        break;
      case "insuranceSale":
      case "insuranceSaleV2":
        await syncSalesReport({ ...step, report: input.report, receiptPrefix: "FA-INS-" });
        break;
      case "incoming":
      case "incomingV2":
        await syncIncomingExpenses({ ...step, report: input.report });
        await syncMovementReport({ ...step, report: input.report, movementType: "IN" });
        break;
      case "supplierReturn":
      case "supplierReturnV2":
        await syncMovementReport({ ...step, report: input.report, movementType: "OUT" });
        break;
      case "writeOff":
        await syncMovementReport({ ...step, report: input.report, movementType: "ADJUST" });
        break;
      case "organizations":
        // Route alohida ishlaydi (sana/filialga bog'liq emas)
        break;
    }
  } catch (error) {
    addError(summary, error);
  }

  return summary;
}
