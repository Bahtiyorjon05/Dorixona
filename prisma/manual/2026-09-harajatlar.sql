-- ═══════════════════════════════════════════════════════════════════════
--  Sentabr 2026 — harajatlar va pereotsenka
--
--  Supabase → SQL Editor → to'liq qo'ying → Run
--
--  XAVFSIZLIK: hech narsa o'chirilmaydi. Har qator "shu nomdagi yozuv
--  sentabrda bormi?" deb tekshiriladi — bor bo'lsa tegilmaydi, shuning
--  uchun ikki marta Run bossangiz ham dublikat bo'lmaydi.
--
--  Nomlar avgustdagi bilan bir xil: oktabrdan doimiy xarajatlar har oy
--  5-sanada o'zi ko'chiriladi (src/lib/recurring-expenses.ts) va nom
--  bo'yicha taniydi. Oyliklar Xodimlar bo'limidagi maoshdan olinadi.
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO "Expense" ("id", "title", "category", "amount", "spentAt",
                       "isRecurring", "unit", "branchId", "createdAt")
SELECT
    gen_random_uuid()::text, v."title", v."category"::"ExpenseCategory",
    v."amount", TIMESTAMP '2026-09-05 12:00:00',
    v."recurring", v."unit",
    (SELECT "id" FROM "Branch" ORDER BY "createdAt" LIMIT 1),
    now()
FROM (VALUES
    -- ── Bir martalik ──
    ('Kamera',               'OTHER',      8000000, false, NULL),

    -- ── Ijara (dorixonalarga ajratilgan) ──
    ('Ijara — Shayxontohur', 'RENT',      20000000, true,  'Shayxontohur'),
    ('Ijara — Yunusobod',    'RENT',       7500000, true,  'Yunusobod'),

    -- ── Kommunal ──
    ('Svet (elektr)',        'UTILITIES',  2500000, true,  NULL),
    ('JEK',                  'UTILITIES',  1000000, true,  NULL),

    -- ── Soliq va rasmiy ──
    ('Soliq',                'LICENSE',    3000000, true,  NULL),
    ('Soliq to''lov',        'LICENSE',    5000000, true,  NULL),
    ('QQS (NDS)',            'LICENSE',   18000000, true,  NULL),
    ('Diplom',               'LICENSE',    2000000, true,  NULL),

    -- ── Xizmatlar ──
    ('Buxgalter',            'OTHER',      4000000, true,  NULL),
    ('FARM kom',             'OTHER',      2500000, true,  NULL),
    ('Srok (muddati o''tgan)','OTHER',      2000000, true,  NULL)
    -- Yopilgan apteka yozilmaydi: u Qarzlar bo'limida yuritiladi
) AS v("title", "category", "amount", "recurring", "unit")
WHERE NOT EXISTS (
    SELECT 1 FROM "Expense" e
    WHERE e."title" = v."title"
      AND e."spentAt" >= TIMESTAMP '2026-09-01 00:00:00'
      AND e."spentAt" <  TIMESTAMP '2026-10-01 00:00:00'
);


-- ─── Oyliklar: Xodimlar bo'limidan ─────────────────────────────────────
-- Har bir aktiv xodimning hozirgi maoshi, o'z dorixonasiga. Shu oyda
-- oylik qo'lda yozilgan bo'lsa ("Oylik — Dilnoz" yoki to'liq ism bilan),
-- o'sha xodimga tegilmaydi.
INSERT INTO "Expense" ("id", "title", "category", "amount", "spentAt",
                       "isRecurring", "unit", "branchId", "createdAt")
SELECT
    gen_random_uuid()::text,
    'Oylik — ' || x."name",
    'SALARY'::"ExpenseCategory",
    x."baseSalary", TIMESTAMP '2026-09-05 12:00:00',
    true, x."unit", x."branchId", now()
FROM (
    SELECT regexp_replace(trim("fullName"), '\s+', ' ', 'g') AS "name",
           "baseSalary", "unit", "branchId"
    FROM "Employee"
    WHERE "status" = 'ACTIVE' AND "baseSalary" > 0
) x
WHERE NOT EXISTS (
    SELECT 1 FROM "Expense" e
    WHERE e."category" = 'SALARY'
      AND lower(e."title") IN (lower('Oylik — ' || x."name"),
                               lower('Oylik — ' || split_part(x."name", ' ', 1)))
      AND e."spentAt" >= TIMESTAMP '2026-09-01 00:00:00'
      AND e."spentAt" <  TIMESTAMP '2026-10-01 00:00:00'
);


-- ─── Pereotsenka: dorixonaga taqsimlanmagan, 37 mln ─────────────────────
-- Avgustdagidek "Umumiy" qatoriga. Qator bor bo'lsa faqat pereotsenka
-- yangilanadi, qolgan raqamlarga tegilmaydi.
INSERT INTO "MonthlyFinance" (
    "id", "unit", "periodMonth",
    "turnover", "profit", "stockValue", "revaluation",
    "note", "branchId", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, 'Umumiy', TIMESTAMP '2026-09-01 00:00:00',
    0, 0, 0, 37000000,
    'Taqsimlanmagan pereotsenka',
    (SELECT "id" FROM "Branch" ORDER BY "createdAt" LIMIT 1),
    now(), now()
ON CONFLICT ("unit", "periodMonth") DO UPDATE SET
    "revaluation" = EXCLUDED."revaluation",
    "updatedAt"   = now();


-- ─── Natijani tekshirish: sentabrdagi hamma yozuv ───────────────────────
-- Ro'yxatdagi summa jadvaldagidan farq qilsa — o'sha yozuv oldin qo'lda
-- kiritilgan va yuqoridagi INSERT unga tegmagan. Ilovada tahrirlang.
SELECT
    "title"                     AS "nomi",
    COALESCE("unit", 'Umumiy')  AS "dorixona",
    "category"                  AS "toifa",
    "amount"                    AS "summa",
    "isRecurring"               AS "doimiy",
    to_char("spentAt", 'DD.MM') AS "sana"
FROM "Expense"
WHERE "spentAt" >= TIMESTAMP '2026-09-01 00:00:00'
  AND "spentAt" <  TIMESTAMP '2026-10-01 00:00:00'
  AND "title" NOT LIKE 'F-Apteka kirim%'
ORDER BY "isRecurring" DESC, "category", "title";
