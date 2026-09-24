-- ═══════════════════════════════════════════════════════════════════════
--  DebtEntry.ref — F-Apteka kirim hujjatidan kelgan qarz yozuvi belgisi
--
--  NEGA KERAK: firmadan tovar olinganda qarz avtomatik yoziladi. Har
--  hujjat bir marta yozilishi uchun uning raqami saqlanadi ("FA:INC:1112").
--  To'lovlar esa qo'lda kiritiladi — F-Apteka to'lovlarni bermaydi.
--
--  QANDAY ISHLATILADI: Supabase → SQL Editor → qo'yib Run bosing.
--  Avval qarzlar.sql bajarilgan bo'lishi kerak.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "DebtEntry" ADD COLUMN IF NOT EXISTS "ref" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "DebtEntry_ref_key" ON "DebtEntry" ("ref");

SELECT COUNT(*) AS "kirimdan_kelgan_qarz_yozuvlari"
  FROM "DebtEntry" WHERE "ref" IS NOT NULL;
