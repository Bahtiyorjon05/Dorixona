-- ═══════════════════════════════════════════════════════════════════════
--  DailySales — kunlik savdo hujjat turi (DOCTYPE) kesimida
--
--  NEGA KERAK: 4-hisobotda to'lov turi yo'q, shuning uchun hamma savdo
--  "naqd" bo'lib yozilardi. 22-hisobotda har hujjatning turi bor (DT):
--  shu orqali naqd va terminal ajratiladi.
--
--  QANDAY ISHLATILADI: Supabase → SQL Editor → qo'yib Run bosing.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "DailySales" (
  "id"        TEXT PRIMARY KEY,
  "day"       TIMESTAMP(3) NOT NULL,
  "unit"      TEXT NOT NULL DEFAULT 'Umumiy',
  "docType"   TEXT NOT NULL,
  "amount"    DECIMAL(16,2) NOT NULL,
  "cost"      DECIMAL(16,2) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Bir kun + bir dorixona + bir hujjat turi = bitta yozuv
CREATE UNIQUE INDEX IF NOT EXISTS "DailySales_day_unit_docType_key"
  ON "DailySales" ("day", "unit", "docType");
CREATE INDEX IF NOT EXISTS "DailySales_day_idx" ON "DailySales" ("day");

SELECT COUNT(*) AS "kunlik_savdo_yozuvlari" FROM "DailySales";
