-- ═══════════════════════════════════════════════════════════════════════
--  Avgust 2026 — qolgan ikki yozuv
--    1) "Otabek aka — bank" 48 mln (harajat)
--    2) Yopilgan aptekaga qarz: jami 70 mln, to'langan 20 mln, qoldiq 50 mln
--
--  Supabase → SQL Editor → Run. Hech narsa o'chirilmaydi, qayta ishga
--  tushirsangiz ham dublikat bo'lmaydi.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1. Otabek aka — bank (48 mln) ────────────────────────────────────
--  "Doimiy" belgilanmagan. Agar bu har oy takrorlansa, ilovada yozuvni
--  tahrirlab "Doimiy xarajat" ni belgilang — shunda "Oldingi oydan"
--  tugmasi uni ham keyingi oyga ko'chiradi.
INSERT INTO "Expense" ("id", "title", "category", "amount", "spentAt",
                       "isRecurring", "unit", "branchId", "createdAt")
SELECT
    gen_random_uuid()::text, 'Otabek aka — bank', 'OTHER'::"ExpenseCategory",
    48000000, TIMESTAMP '2026-08-31 12:00:00',
    false, NULL,
    (SELECT "id" FROM "Branch" ORDER BY "createdAt" LIMIT 1),
    now()
WHERE NOT EXISTS (
    SELECT 1 FROM "Expense"
    WHERE "title" = 'Otabek aka — bank'
      AND "spentAt" >= TIMESTAMP '2026-08-01 00:00:00'
      AND "spentAt" <  TIMESTAMP '2026-09-01 00:00:00'
);


-- ─── 2. Yopilgan aptekaga qarz ────────────────────────────────────────
--  PAYABLE = biz to'lashimiz kerak.
--  totalAmount 70 mln = to'langan 20 + qoldiq 50.
--  Ilova qoldiqni `totalAmount - paidAmount` qilib hisoblaydi.
INSERT INTO "Debt" ("id", "counterparty", "direction", "totalAmount",
                    "paidAmount", "unit", "note", "branchId",
                    "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text, 'Yopilgan apteka', 'PAYABLE'::"DebtDirection",
    70000000, 20000000, NULL,
    'Avgust 2026 da 20 mln to''landi, qoldiq 50 mln',
    (SELECT "id" FROM "Branch" ORDER BY "createdAt" LIMIT 1),
    now(), now()
WHERE NOT EXISTS (
    SELECT 1 FROM "Debt" WHERE "counterparty" = 'Yopilgan apteka'
);


-- ─── Tekshirish ───────────────────────────────────────────────────────
SELECT "counterparty" AS "kim", "direction" AS "yonalish",
       "totalAmount"  / 1000000 AS "jami_mln",
       "paidAmount"   / 1000000 AS "tolangan_mln",
       ("totalAmount" - "paidAmount") / 1000000 AS "qoldiq_mln"
FROM "Debt"
ORDER BY "createdAt";
