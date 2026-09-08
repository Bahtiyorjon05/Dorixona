-- Avgust 2026 — dorixonaga taqsimlanmagan pereotsenka: 34 mln
--
-- Iyul ma'lumoti ham shu tartibda kiritilgan ("Umumiy" qatori,
-- revaluation = 45 mln). Supabase → SQL Editor → Run.
--
-- Xavfsiz: hech narsa o'chirilmaydi, qayta ishga tushirsa yangilanadi.

INSERT INTO "MonthlyFinance" (
    "id", "unit", "periodMonth",
    "turnover", "profit", "stockValue", "revaluation",
    "note", "branchId", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, 'Umumiy', TIMESTAMP '2026-08-01 00:00:00',
    0, 0, 0, 34000000,
    'Taqsimlanmagan pereotsenka',
    (SELECT "id" FROM "Branch" ORDER BY "createdAt" LIMIT 1),
    now(), now()
ON CONFLICT ("unit", "periodMonth") DO UPDATE SET
    "revaluation" = EXCLUDED."revaluation",
    "note"        = EXCLUDED."note",
    "updatedAt"   = now();

-- Tekshirish
SELECT to_char("periodMonth", 'YYYY-MM') AS "oy", "unit",
       "revaluation" / 1000000 AS "pereotsenka_mln"
FROM "MonthlyFinance"
WHERE "revaluation" > 0
ORDER BY "periodMonth" DESC;
