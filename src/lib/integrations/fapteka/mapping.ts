export const FAPTEKA_SKU_PREFIX = "FA:";
export const FAPTEKA_RECEIPT_PREFIX = "FA-";

export type FaptekaReportKey =
  | "catalog"
  | "stock"
  | "incoming"
  | "incomingV2"
  | "supplierReturn"
  | "supplierReturnV2"
  | "writeOff"
  | "retailSale"
  | "retailSaleV2"
  | "insuranceSale"
  | "insuranceSaleV2"
  | "organizations";

export type FaptekaReport = {
  key: FaptekaReportKey;
  id: number;
  title: string;
  direction: "F_APTEKA_TO_ERP" | "F_KASSA_TO_ERP";
  erpTarget: string;
  fields: { key: string; meaning: string; erpField: string }[];
  preferred?: boolean;
};

export const FAPTEKA_REPORTS: Record<FaptekaReportKey, FaptekaReport> = {
  stock: {
    key: "stock",
    id: 6,
    title: "Ostatki tekushchie",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "Product.stock, Product.salePrice, Product.expiryDate",
    preferred: true,
    fields: [
      { key: "G", meaning: "F-Apteka tovar ID", erpField: "Product.sku = FA:<G>" },
      { key: "P", meaning: "Chakana narx", erpField: "Product.salePrice" },
      { key: "E", meaning: "Yaroqlilik muddati", erpField: "Product.expiryDate" },
      { key: "O", meaning: "Filial/bo'lim ID", erpField: "Branch mapping / filter" },
      { key: "Q", meaning: "Joriy qoldiq", erpField: "Product.stock" },
    ],
  },
  catalog: {
    key: "catalog",
    id: 188,
    title: "Spravochnik tovarov",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "Product.name, Product.unit, Product.sku",
    preferred: true,
    fields: [
      { key: "I", meaning: "F-Apteka tovar ID", erpField: "Product.sku = FA:<I>" },
      { key: "N", meaning: "Tovar nomi", erpField: "Product.name" },
      { key: "P", meaning: "Ishlab chiqaruvchi", erpField: "Mapping metadata" },
      { key: "E", meaning: "O'lchov birligi", erpField: "Product.unit" },
      { key: "C", meaning: "IKPU/MXIK", erpField: "Mapping metadata" },
    ],
  },
  incoming: {
    key: "incoming",
    id: 1,
    title: "Prihody na sklad",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "StockMovement(IN), Product.costPrice",
    fields: [
      { key: "D", meaning: "Sana", erpField: "StockMovement.createdAt" },
      { key: "N", meaning: "Ichki hujjat raqami", erpField: "StockMovement.note" },
      { key: "I", meaning: "Yetkazib beruvchi INN", erpField: "Organization mapping" },
      { key: "G", meaning: "F-Apteka tovar ID", erpField: "Product.sku lookup" },
      { key: "IK", meaning: "IKPU/MXIK", erpField: "Mapping metadata" },
      { key: "S", meaning: "Seriya", erpField: "StockMovement.note" },
      { key: "E", meaning: "Yaroqlilik muddati", erpField: "Product.expiryDate" },
      { key: "Q", meaning: "Miqdor", erpField: "StockMovement.quantity" },
      { key: "P", meaning: "Kirim narxi QQSsiz", erpField: "Product.costPrice" },
      { key: "SP", meaning: "Kirim summasi QQSsiz", erpField: "Analytics" },
      { key: "SN", meaning: "QQS summasi", erpField: "Analytics" },
    ],
  },
  incomingV2: {
    key: "incomingV2",
    id: 11,
    title: "Prihody na sklad Ver.2",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "StockMovement(IN), Product.costPrice",
    preferred: true,
    fields: [
      { key: "ID", meaning: "Hujjat ID", erpField: "StockMovement.note" },
      { key: "D", meaning: "Sana", erpField: "StockMovement.createdAt" },
      { key: "PD", meaning: "Yetkazib beruvchi sanasi", erpField: "StockMovement.note" },
      { key: "PN", meaning: "Schet-faktura raqami", erpField: "StockMovement.note" },
      { key: "I", meaning: "Kontragent ID", erpField: "Organization mapping" },
      { key: "G", meaning: "F-Apteka tovar ID", erpField: "Product.sku lookup" },
      { key: "Q", meaning: "Miqdor", erpField: "StockMovement.quantity" },
      { key: "P", meaning: "Kirim narxi QQSsiz", erpField: "Product.costPrice" },
    ],
  },
  supplierReturn: {
    key: "supplierReturn",
    id: 2,
    title: "Vozvrat postavshchiku",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "StockMovement(OUT)",
    fields: [
      { key: "D", meaning: "Sana", erpField: "StockMovement.createdAt" },
      { key: "G", meaning: "F-Apteka tovar ID", erpField: "Product.sku lookup" },
      { key: "Q", meaning: "Miqdor", erpField: "StockMovement.quantity" },
    ],
  },
  supplierReturnV2: {
    key: "supplierReturnV2",
    id: 12,
    title: "Vozvrat postavshchiku Ver.2",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "StockMovement(OUT)",
    preferred: true,
    fields: [
      { key: "ID", meaning: "Hujjat ID", erpField: "StockMovement.note" },
      { key: "D", meaning: "Sana", erpField: "StockMovement.createdAt" },
      { key: "I", meaning: "Qabul qiluvchi ID", erpField: "Organization mapping" },
      { key: "G", meaning: "F-Apteka tovar ID", erpField: "Product.sku lookup" },
      { key: "Q", meaning: "Miqdor", erpField: "StockMovement.quantity" },
    ],
  },
  writeOff: {
    key: "writeOff",
    id: 3,
    title: "Spisanie",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "StockMovement(ADJUST)",
    preferred: true,
    fields: [
      { key: "D", meaning: "Sana", erpField: "StockMovement.createdAt" },
      { key: "G", meaning: "F-Apteka tovar ID", erpField: "Product.sku lookup" },
      { key: "Q", meaning: "Miqdor", erpField: "StockMovement.quantity" },
    ],
  },
  retailSale: {
    key: "retailSale",
    id: 4,
    title: "Roznichnaya prodazha",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "Sale, SaleItem",
    fields: [
      { key: "D", meaning: "Sana", erpField: "Sale.createdAt" },
      { key: "G", meaning: "F-Apteka tovar ID", erpField: "Product.sku lookup" },
      { key: "Q", meaning: "Miqdor", erpField: "SaleItem.quantity" },
      { key: "SP", meaning: "Sotuv summasi QQSsiz", erpField: "SaleItem.lineTotal" },
      { key: "SN", meaning: "QQS summasi", erpField: "SaleItem.lineTotal" },
    ],
  },
  retailSaleV2: {
    key: "retailSaleV2",
    id: 14,
    title: "Roznichnaya prodazha Ver.2",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "Sale, SaleItem",
    preferred: true,
    fields: [
      { key: "ID", meaning: "Hujjat/chek ID", erpField: "Sale.receiptNo = FA-<ID>" },
      { key: "F", meaning: "Filial ID", erpField: "Branch mapping / filter" },
      { key: "D", meaning: "Sana", erpField: "Sale.createdAt" },
      { key: "G", meaning: "F-Apteka tovar ID", erpField: "Product.sku lookup" },
      { key: "Q", meaning: "Miqdor", erpField: "SaleItem.quantity" },
      { key: "SP", meaning: "Sotuv summasi QQSsiz", erpField: "SaleItem.lineTotal" },
      { key: "SN", meaning: "QQS summasi", erpField: "SaleItem.lineTotal" },
    ],
  },
  insuranceSale: {
    key: "insuranceSale",
    id: 5,
    title: "Strahovka prodazha",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "Sale, SaleItem",
    fields: [
      { key: "D", meaning: "Sana", erpField: "Sale.createdAt" },
      { key: "G", meaning: "F-Apteka tovar ID", erpField: "Product.sku lookup" },
      { key: "Q", meaning: "Miqdor", erpField: "SaleItem.quantity" },
    ],
  },
  insuranceSaleV2: {
    key: "insuranceSaleV2",
    id: 15,
    title: "Strahovka prodazha Ver.2",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "Sale, SaleItem",
    preferred: true,
    fields: [
      { key: "ID", meaning: "Hujjat ID", erpField: "Sale.receiptNo = FA-INS-<ID>" },
      { key: "F", meaning: "Filial ID", erpField: "Branch mapping / filter" },
      { key: "I", meaning: "Sug'urta kontragent ID", erpField: "Organization mapping" },
      { key: "G", meaning: "F-Apteka tovar ID", erpField: "Product.sku lookup" },
      { key: "L", meaning: "Markirovka kodi", erpField: "SaleItem metadata note" },
    ],
  },
  organizations: {
    key: "organizations",
    id: 189,
    title: "Spravochnik organizatsiy",
    direction: "F_APTEKA_TO_ERP",
    erpTarget: "Branch / supplier / discount / insurance mapping",
    preferred: true,
    fields: [
      { key: "I", meaning: "Tashkilot ID", erpField: "External organization ID" },
      { key: "N", meaning: "Tashkilot nomi", erpField: "Branch.name / metadata" },
      { key: "INN", meaning: "INN", erpField: "Metadata" },
      { key: "APT", meaning: "Filial belgisi", erpField: "Branch mapping" },
      { key: "DIS", meaning: "Diskont belgisi", erpField: "Customer/loyalty mapping" },
      { key: "INS", meaning: "Sug'urta kompaniyasi", erpField: "Insurance mapping" },
    ],
  },
};

export function faptekaSku(id: string | number) {
  return `${FAPTEKA_SKU_PREFIX}${String(id).trim()}`;
}

export function isFaptekaSku(sku?: string | null) {
  return Boolean(sku?.startsWith(FAPTEKA_SKU_PREFIX));
}

export function faptekaReceipt(id: string | number, prefix = FAPTEKA_RECEIPT_PREFIX) {
  return `${prefix}${String(id).trim()}`;
}
