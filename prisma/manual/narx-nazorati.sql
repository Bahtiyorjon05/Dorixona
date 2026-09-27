-- ═══════════════════════════════════════════════════════════════════════
--  Narx nazorati — raqobatchi narxini kuzatish jadvallari
--
--  PriceWatch   — kuzatiladigan dorilar va arzonapteka.uz dagi eng arzon narx
--  PriceSetting — har bir dorixona uchun ustama (5%) va yoqilgan/o'chirilgan
--
--  QANDAY ISHLATILADI: Supabase → SQL Editor → qo'yib Run bosing.
--  Keyin narx-royxati.sql ni ishga tushiring — dorilar ro'yxati to'ladi.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "PriceWatch" (
  "id"              TEXT PRIMARY KEY,
  "name"            TEXT NOT NULL UNIQUE,
  "sourceUrl"       TEXT,
  "sourceTitle"     TEXT,
  "competitorPrice" DECIMAL(16,2),
  "checkedAt"       TIMESTAMP(3),
  "sku"             TEXT,
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PriceWatch_checkedAt_idx" ON "PriceWatch" ("checkedAt");
CREATE INDEX IF NOT EXISTS "PriceWatch_active_idx"    ON "PriceWatch" ("active");

CREATE TABLE IF NOT EXISTS "PriceSetting" (
  "unit"      TEXT PRIMARY KEY,
  "enabled"   BOOLEAN NOT NULL DEFAULT true,
  "percent"   DECIMAL(5,2) NOT NULL DEFAULT 5,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "PriceSetting" ("unit", "enabled", "percent")
VALUES ('Yunusobod', true, 5), ('Shayxontohur', true, 5)
ON CONFLICT ("unit") DO NOTHING;

SELECT (SELECT COUNT(*) FROM "PriceWatch") AS "kuzatilayotgan_dorilar",
       (SELECT COUNT(*) FROM "PriceSetting") AS "dorixona_sozlamalari";

-- ─── Qo'shimcha: ayrim doriga alohida ustama ───────────────────────────
-- Bo'sh bo'lsa dorixona sozlamasidagi foiz ishlatiladi.
ALTER TABLE "PriceWatch" ADD COLUMN IF NOT EXISTS "percent" DECIMAL(5,2);

-- ─── Qo'shimcha: tan narxli dorilarga umumiy ustama ────────────────────
-- Arzonaptekada kuzatilmaydigan dorilar tan narxdan hisoblanadi.
-- Bu ustun shularga umumiy foiz beradi; 0 bo'lsa tavsiya berilmaydi.
ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "costPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
