-- ═══════════════════════════════════════════════════════════════════════
--  Qarzlar bo'limi — Debt jadvaliga yangi ustunlar va DebtEntry tarixi
--
--  NIMA QO'SHILADI:
--    kind      — FIRM (firma tovar qarzi) yoki STREET (ko'chadagi naqd qarz)
--    currency  — UZS yoki USD
--    dueDate   — to'lash muddati (eslatma shunga qarab beriladi)
--    closedAt  — yopilgan sana
--    DebtEntry — har bir harakat: yangi qarz (CHARGE) yoki to'lov (PAYMENT)
--
--  Mavjud qarz yozuvlariga tegilmaydi: ular FIRM va UZS bo'lib qoladi,
--  jami/to'langan summalari o'z holicha saqlanadi.
--
--  QANDAY ISHLATILADI: Supabase → SQL Editor → shu matnni qo'yib Run.
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Yangi turlar
DO $$ BEGIN
  CREATE TYPE "DebtKind" AS ENUM ('FIRM', 'STREET');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DebtCurrency" AS ENUM ('UZS', 'USD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DebtEntryType" AS ENUM ('CHARGE', 'PAYMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Debt jadvaliga ustunlar
ALTER TABLE "Debt" ADD COLUMN IF NOT EXISTS "kind"     "DebtKind"     NOT NULL DEFAULT 'FIRM';
ALTER TABLE "Debt" ADD COLUMN IF NOT EXISTS "currency" "DebtCurrency" NOT NULL DEFAULT 'UZS';
ALTER TABLE "Debt" ADD COLUMN IF NOT EXISTS "dueDate"  TIMESTAMP(3);
ALTER TABLE "Debt" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Debt_kind_closedAt_idx" ON "Debt" ("kind", "closedAt");
CREATE INDEX IF NOT EXISTS "Debt_dueDate_idx"       ON "Debt" ("dueDate");

-- 3) Harakatlar tarixi
CREATE TABLE IF NOT EXISTS "DebtEntry" (
  "id"         TEXT PRIMARY KEY,
  "debtId"     TEXT NOT NULL REFERENCES "Debt"("id") ON DELETE CASCADE,
  "type"       "DebtEntryType" NOT NULL,
  "amount"     DECIMAL(16,2) NOT NULL,
  "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DebtEntry_debtId_happenedAt_idx"
  ON "DebtEntry" ("debtId", "happenedAt");

-- 4) Eski qarzlar uchun boshlang'ich harakat yozamiz, aks holda tarix bo'sh
--    ko'rinadi (jami va to'langan summalari o'z joyida qoladi)
INSERT INTO "DebtEntry" ("id", "debtId", "type", "amount", "happenedAt", "note")
SELECT gen_random_uuid()::text, d."id", 'CHARGE', d."totalAmount", d."createdAt",
       'Boshlang''ich qoldiq'
  FROM "Debt" d
 WHERE NOT EXISTS (SELECT 1 FROM "DebtEntry" e WHERE e."debtId" = d."id");

INSERT INTO "DebtEntry" ("id", "debtId", "type", "amount", "happenedAt", "note")
SELECT gen_random_uuid()::text, d."id", 'PAYMENT', d."paidAmount", d."updatedAt",
       'Boshlang''ich to''lov'
  FROM "Debt" d
 WHERE d."paidAmount" > 0
   AND NOT EXISTS (
     SELECT 1 FROM "DebtEntry" e WHERE e."debtId" = d."id" AND e."type" = 'PAYMENT'
   );

-- 5) Tekshirish
SELECT d."counterparty", d."kind", d."currency",
       d."totalAmount", d."paidAmount",
       (d."totalAmount" - d."paidAmount") AS "qoldiq",
       (SELECT COUNT(*) FROM "DebtEntry" e WHERE e."debtId" = d."id") AS "harakatlar"
  FROM "Debt" d
 ORDER BY d."createdAt";
