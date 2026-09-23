export type IncomingExpenseEntry = {
  docId: string;
  quantity: number;
  price: number;
  spentAt: Date;
  /** Yetkazib beruvchi nomi — harajat nomida ko'rinadi */
  supplier?: string;
};

export type IncomingExpenseGroup = {
  docId: string;
  amount: number;
  spentAt: Date;
  supplier?: string;
};

export function buildIncomingExpenseEntries(rows: IncomingExpenseEntry[]): IncomingExpenseGroup[] {
  const grouped = new Map<string, { amount: number; spentAt: Date; supplier?: string }>();

  for (const row of rows) {
    if (!row.docId || row.quantity <= 0) continue;
    const current = grouped.get(row.docId) ?? { amount: 0, spentAt: row.spentAt };
    grouped.set(row.docId, {
      amount: current.amount + row.quantity * row.price,
      spentAt: current.spentAt && row.spentAt < current.spentAt ? row.spentAt : current.spentAt,
      supplier: current.supplier || row.supplier,
    });
  }

  // supplier faqat ma'lum bo'lsa qo'shiladi
  return Array.from(grouped.entries()).map(([docId, value]) => ({
    docId,
    amount: value.amount,
    spentAt: value.spentAt,
    ...(value.supplier ? { supplier: value.supplier } : {}),
  }));
}
