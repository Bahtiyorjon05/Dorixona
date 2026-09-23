-- ═══════════════════════════════════════════════════════════════════════
--  FaptekaOrg jadvali — F-Apteka tashkilotlari (189-hisobot)
--
--  NEGA KERAK: kirim harajati hozir "F-Apteka kirim #1107" deb yoziladi,
--  raqamning o'zi hech nima demaydi. Bu jadval to'lgach, nomda yetkazib
--  beruvchi ham ko'rinadi: "F-Apteka kirim #1107 — OOO FARM SAVDO".
--
--  QANDAY ISHLATILADI: Supabase Dashboard → SQL Editor → shu matnni
--  qo'yib Run bosing. Bir marta bajariladi, ma'lumotni keyin ko'prik
--  skript o'zi to'ldiradi.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "FaptekaOrg" (
  "id"         TEXT PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "inn"        TEXT,
  "isSupplier" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "FaptekaOrg_inn_idx" ON "FaptekaOrg" ("inn");

-- Tekshirish: bo'sh jadval qaytadi, xato bo'lmasa hammasi joyida
SELECT COUNT(*) AS "tashkilotlar" FROM "FaptekaOrg";
