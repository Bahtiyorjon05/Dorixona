export type IncomingExpenseEntry = {
  docId: string;
  quantity: number;
  price: number;
  spentAt: Date;
  /** Yetkazib beruvchi nomi — harajat nomida ko'rinadi */
  supplier?: string;
  /** Qaysi dorixonaga kelgani; noma'lum bo'lsa null (= Umumiy) */
  unit?: string | null;
};

export type IncomingExpenseGroup = {
  docId: string;
  amount: number;
  spentAt: Date;
  supplier?: string;
  unit: string | null;
};

/** Bitta hujjat ichida ikki dorixona bo'lsa, ular alohida harajat bo'ladi */
export function expenseGroupKey(docId: string, unit?: string | null) {
  return `${docId}\u0000${unit ?? ""}`;
}

export function buildIncomingExpenseEntries(rows: IncomingExpenseEntry[]): IncomingExpenseGroup[] {
  const grouped = new Map<
    string,
    { docId: string; unit: string | null; amount: number; spentAt: Date; supplier?: string }
  >();

  for (const row of rows) {
    if (!row.docId || row.quantity <= 0) continue;
    const unit = row.unit ?? null;
    const key = expenseGroupKey(row.docId, unit);
    const current = grouped.get(key) ?? { docId: row.docId, unit, amount: 0, spentAt: row.spentAt };
    grouped.set(key, {
      docId: row.docId,
      unit,
      amount: current.amount + row.quantity * row.price,
      spentAt: current.spentAt && row.spentAt < current.spentAt ? row.spentAt : current.spentAt,
      supplier: current.supplier || row.supplier,
    });
  }

  // supplier faqat ma'lum bo'lsa qo'shiladi
  return Array.from(grouped.values()).map((value) => ({
    docId: value.docId,
    amount: value.amount,
    spentAt: value.spentAt,
    unit: value.unit,
    ...(value.supplier ? { supplier: value.supplier } : {}),
  }));
}
