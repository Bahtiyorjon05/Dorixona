import assert from "node:assert/strict";
import test from "node:test";

import { buildIncomingExpenseEntries } from "./expense-helpers";

test("groups incoming rows by document id and sums amounts", () => {
  const entries = buildIncomingExpenseEntries([
    { docId: "INV-001", quantity: 2, price: 10000, spentAt: new Date("2024-01-10T00:00:00.000Z") },
    { docId: "INV-001", quantity: 3, price: 5000, spentAt: new Date("2024-01-12T00:00:00.000Z") },
    { docId: "INV-002", quantity: 1, price: 7000, spentAt: new Date("2024-01-15T00:00:00.000Z") },
    { docId: "", quantity: 1, price: 5000, spentAt: new Date("2024-01-16T00:00:00.000Z") },
    { docId: "INV-003", quantity: 0, price: 1000, spentAt: new Date("2024-01-16T00:00:00.000Z") },
  ]);

  assert.deepEqual(entries, [
    { docId: "INV-001", amount: 35000, spentAt: new Date("2024-01-10T00:00:00.000Z") },
    { docId: "INV-002", amount: 7000, spentAt: new Date("2024-01-15T00:00:00.000Z") },
  ]);
});
