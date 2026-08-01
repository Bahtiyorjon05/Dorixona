export type IncomingExpenseEntry = {
  docId: string;
  quantity: number;
  price: number;
  spentAt: Date;
};

export function buildIncomingExpenseEntries(rows: IncomingExpenseEntry[]) {
  const grouped = new Map<string, { amount: number; spentAt: Date }>();

  for (const row of rows) {
    if (!row.docId || row.quantity <= 0) continue;
    const current = grouped.get(row.docId) ?? { amount: 0, spentAt: row.spentAt };
    grouped.set(row.docId, {
      amount: current.amount + row.quantity * row.price,
      spentAt: current.spentAt && row.spentAt < current.spentAt ? row.spentAt : current.spentAt,
    });
  }

  return Array.from(grouped.entries()).map(([docId, value]) => ({
    docId,
    amount: value.amount,
    spentAt: value.spentAt,
  }));
}
