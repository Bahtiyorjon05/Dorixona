-- Kassir smenalari: F-Apteka cheklaridan (relay v22+).
-- Supabase -> SQL Editor -> Run. Qayta ishga tushirsa ham xavfsiz.

CREATE TABLE IF NOT EXISTS "CashierShift" (
    "id"        TEXT NOT NULL,
    "unit"      TEXT NOT NULL,
    "shiftId"   TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "cashier"   TEXT NOT NULL,
    "openedAt"  TIMESTAMP(3) NOT NULL,
    "closedAt"  TIMESTAMP(3) NOT NULL,
    "day"       TIMESTAMP(3) NOT NULL,
    "checks"    INTEGER NOT NULL DEFAULT 0,
    "sales"     DECIMAL(16,2) NOT NULL DEFAULT 0,
    "returns"   DECIMAL(16,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashierShift_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CashierShift_unit_shiftId_userId_key" ON "CashierShift" ("unit", "shiftId", "userId");
CREATE INDEX IF NOT EXISTS "CashierShift_day_idx" ON "CashierShift" ("day");

-- Tekshirish: oylar bo'yicha kassirlar
SELECT to_char("day", 'YYYY-MM') AS oy, "unit", "cashier",
       COUNT(*) AS smena, SUM("checks") AS chek, ROUND(SUM("sales" - "returns")) AS savdo
FROM "CashierShift" GROUP BY 1, 2, 3 ORDER BY 1 DESC, 2, 6 DESC;
