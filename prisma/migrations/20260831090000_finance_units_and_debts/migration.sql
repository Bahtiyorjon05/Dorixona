-- Xarajatlarni dorixona birligiga boglash uchun (Yunus / Kora)
ALTER TABLE "Expense" ADD COLUMN "unit" TEXT;
CREATE INDEX "Expense_unit_idx" ON "Expense"("unit");

-- Qarz yonalishi
CREATE TYPE "DebtDirection" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- Oylik moliyaviy xulosa
CREATE TABLE "MonthlyFinance" (
    "id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "turnover" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "stockValue" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "revaluation" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "bankBalance" DECIMAL(16,2),
    "note" TEXT,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyFinance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MonthlyFinance_unit_periodMonth_key" ON "MonthlyFinance"("unit", "periodMonth");
CREATE INDEX "MonthlyFinance_branchId_idx" ON "MonthlyFinance"("branchId");
CREATE INDEX "MonthlyFinance_periodMonth_idx" ON "MonthlyFinance"("periodMonth");
ALTER TABLE "MonthlyFinance" ADD CONSTRAINT "MonthlyFinance_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Qarzlar
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "direction" "DebtDirection" NOT NULL,
    "totalAmount" DECIMAL(16,2) NOT NULL,
    "paidAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "unit" TEXT,
    "note" TEXT,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Debt_branchId_idx" ON "Debt"("branchId");
CREATE INDEX "Debt_direction_idx" ON "Debt"("direction");
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
