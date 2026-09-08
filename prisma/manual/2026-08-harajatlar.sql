-- ═══════════════════════════════════════════════════════════════════════
--  Avgust 2026 — harajatlar
--
--  Supabase → SQL Editor → to'liq qo'ying → Run
--
--  XAVFSIZLIK: hech narsa o'chirilmaydi. Har qator "shu nomdagi yozuv
--  avgustda bormi?" deb tekshiriladi, shuning uchun ikki marta Run
--  bossangiz ham dublikat bo'lmaydi.
--
--  isRecurring = true bo'lgan qatorlar har oy takrorlanadi — ilovadagi
--  "Oldingi oydan ko'chirish" tugmasi aynan shularni sentabrga nusxalaydi.
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO "Expense" ("id", "title", "category", "amount", "spentAt",
                       "isRecurring", "unit", "branchId", "createdAt")
SELECT
    gen_random_uuid()::text, v."title", v."category"::"ExpenseCategory",
    v."amount", TIMESTAMP '2026-08-31 12:00:00',
    v."recurring", v."unit",
    (SELECT "id" FROM "Branch" ORDER BY "createdAt" LIMIT 1),
    now()
FROM (VALUES
    -- ── Ijara (dorixonalarga ajratilgan) ──
    ('Ijara — Qoraqamish',   'RENT',      19200000, true,  'Qoraqamish'),
    ('Ijara — Yunusobod',    'RENT',       7200000, true,  'Yunusobod'),

    -- ── Kommunal ──
    ('Svet (elektr)',        'UTILITIES',  2000000, true,  NULL),
    ('JEK',                  'UTILITIES',   600000, true,  NULL),

    -- ── Soliq va rasmiy ──
    ('Soliq',                'LICENSE',    1200000, true,  NULL),
    ('Soliq to''lov',        'LICENSE',    5000000, true,  NULL),
    ('QQS (NDS)',            'LICENSE',   14000000, true,  NULL),
    ('Diplom',               'LICENSE',    1800000, false, NULL),

    -- ── Xizmatlar ──
    ('Buxgalter',            'OTHER',      4000000, true,  NULL),
    ('FARM kom',             'OTHER',      2400000, true,  NULL),
    ('Srok (muddati o''tgan)','OTHER',      2000000, false, NULL),
    ('Yopilgan aptekadan to''lov', 'OTHER', 20000000, false, NULL),

    -- ── Oyliklar: Yunusobod ──
    ('Oylik — Dilnoz',       'SALARY',     7500000, true,  'Yunusobod'),
    ('Oylik — Umida',        'SALARY',      450000, true,  'Yunusobod'),
    ('Oylik — Umid',         'SALARY',     6500000, true,  'Yunusobod'),
    ('Oylik — Nurbek',       'SALARY',      400000, true,  'Yunusobod'),

    -- ── Oyliklar: Qoraqamish ──
    ('Oylik — Zafar',        'SALARY',     6000000, true,  'Qoraqamish'),
    ('Oylik — Dilsora',      'SALARY',     4000000, true,  'Qoraqamish'),
    ('Oylik — O''ktam',      'SALARY',    24000000, true,  'Qoraqamish')
) AS v("title", "category", "amount", "recurring", "unit")
WHERE NOT EXISTS (
    SELECT 1 FROM "Expense" e
    WHERE e."title" = v."title"
      AND e."spentAt" >= TIMESTAMP '2026-08-01 00:00:00'
      AND e."spentAt" <  TIMESTAMP '2026-09-01 00:00:00'
);


-- ─── Natijani tekshirish ──────────────────────────────────────────────
SELECT
    COALESCE("unit", 'Umumiy')  AS "dorixona",
    "category"                  AS "toifa",
    COUNT(*)                    AS "yozuv",
    SUM("amount") / 1000000     AS "jami_mln"
FROM "Expense"
WHERE "spentAt" >= TIMESTAMP '2026-08-01 00:00:00'
  AND "spentAt" <  TIMESTAMP '2026-09-01 00:00:00'
GROUP BY ROLLUP (COALESCE("unit", 'Umumiy'), "category")
ORDER BY 1 NULLS LAST, 2 NULLS LAST;
