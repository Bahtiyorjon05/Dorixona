-- ═══════════════════════════════════════════════════════════════════════
--  1) Sale.unit ustuni  2) Avgust 2026 moliyaviy xulosasi
--
--  QANDAY ISHLATILADI:
--    Supabase Dashboard → SQL Editor → New query → to'liq qo'ying → Run
--
--  XAVFSIZLIK: hech narsa o'chirilmaydi. Avgust yozuvi bo'lsa yangilanadi,
--  bo'lmasa qo'shiladi. Qayta ishga tushirsa ham dublikat bo'lmaydi.
--
--  MUHIM: 1-bo'limni deploy'dan OLDIN bajaring. Yangi kod "Sale"."unit"
--  ustuniga murojaat qiladi — ustunsiz sahifa xato beradi.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1. Savdoni dorixonaga ajratish uchun ustun ───────────────────────
--  Bo'sh (NULL) = hali ajratilmagan. F-Apteka ikkinchi dorixonaga
--  ulangach shu ustun to'ladi va avtomatik hisob ishlay boshlaydi.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "unit" TEXT;
CREATE INDEX IF NOT EXISTS "Sale_unit_idx" ON "Sale"("unit");

--  Prisma migratsiya yozuvi — busiz `prisma migrate deploy` shu
--  migratsiyani qayta qo'llamoqchi bo'lib xato beradi.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '_prisma_migrations'
    ) THEN
        INSERT INTO "_prisma_migrations"
            (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
        SELECT
            gen_random_uuid()::text,
            '07bbf880f1b19f83b62e17642aa1e791def6ac1ea2b23620a70f10a5eb1fd9df',
            now(), '20260908130000_sale_unit', now(), 1
        WHERE NOT EXISTS (
            SELECT 1 FROM "_prisma_migrations"
            WHERE migration_name = '20260908130000_sale_unit'
        );
    END IF;
END $$;


-- ─── 2. Avgust 2026 ───────────────────────────────────────────────────
--  Yunusobod : savdo 671 mln · foyda 71 mln · astatka 1282 mln
--  Shayxontohur: savdo 610 mln · foyda 54 mln · astatka 1210 mln
--
--  Pereotsenka 34 mln filialga taqsimlanmagani uchun 0 qoldirildi —
--  taqsimot aniqlangach ilovadagi ✎ tugmasi orqali kiritiladi.
--
--  periodMonth UTC yarim tunda saqlanadi (kod ham shunday o'qiydi).
INSERT INTO "MonthlyFinance" (
    "id", "unit", "periodMonth",
    "turnover", "profit", "stockValue", "revaluation",
    "note", "branchId", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, v."unit", TIMESTAMP '2026-08-01 00:00:00',
    v."turnover", v."profit", v."stockValue", 0,
    'Qo''lda kiritilgan hisob-kitob',
    (SELECT "id" FROM "Branch" ORDER BY "createdAt" LIMIT 1),
    now(), now()
FROM (VALUES
    ('Yunusobod',  671000000, 71000000, 1282000000),
    ('Shayxontohur', 610000000, 54000000, 1210000000)
) AS v("unit", "turnover", "profit", "stockValue")
ON CONFLICT ("unit", "periodMonth") DO UPDATE SET
    "turnover"   = EXCLUDED."turnover",
    "profit"     = EXCLUDED."profit",
    "stockValue" = EXCLUDED."stockValue",
    "note"       = EXCLUDED."note",
    "updatedAt"  = now();


-- ─── 3. Natijani tekshirish ───────────────────────────────────────────
SELECT
    to_char("periodMonth", 'YYYY-MM')  AS "oy",
    "unit"                            AS "dorixona",
    "turnover"    / 1000000           AS "savdo_mln",
    "profit"      / 1000000           AS "foyda_mln",
    "stockValue"  / 1000000           AS "astatka_mln",
    "revaluation" / 1000000           AS "pereotsenka_mln"
FROM "MonthlyFinance"
ORDER BY "periodMonth" DESC, "unit";
