-- ═══════════════════════════════════════════════════════════════════════
--  "Qoraqamish" → "Shayxontohur" (barcha jadvallarda)
--
--  F-Apteka'dagi filiallar ro'yxatida (Spravochnaya → Filialy) ikkinchi
--  dorixona ШАЙХАНТОХУР deb ro'yxatdan o'tgan, "Qoraqamish" degan filial
--  umuman yo'q. Shuning uchun ERP'dagi nom ham moslashtiriladi.
--
--  Supabase → SQL Editor → Run. Hech narsa o'chirilmaydi, faqat nom
--  o'zgaradi. Qayta ishga tushirsa ham zarari yo'q.
-- ═══════════════════════════════════════════════════════════════════════

-- Oylik moliyaviy xulosa (savdo, foyda, astatka, pereotsenka)
UPDATE "MonthlyFinance" SET "unit" = 'Shayxontohur' WHERE "unit" = 'Qoraqamish';

-- Harajatlar (ijara, oyliklar)
UPDATE "Expense" SET "unit" = 'Shayxontohur' WHERE "unit" = 'Qoraqamish';

-- Harajat nomlari ichidagi matn ham: "Ijara — Qoraqamish"
UPDATE "Expense"
SET "title" = REPLACE("title", 'Qoraqamish', 'Shayxontohur')
WHERE "title" LIKE '%Qoraqamish%';

-- Xodimlar
UPDATE "Employee" SET "unit" = 'Shayxontohur' WHERE "unit" = 'Qoraqamish';

-- Savdo (hozircha bo'sh, lekin kelajak uchun)
UPDATE "Sale" SET "unit" = 'Shayxontohur' WHERE "unit" = 'Qoraqamish';

-- Qarzlar
UPDATE "Debt" SET "unit" = 'Shayxontohur' WHERE "unit" = 'Qoraqamish';


-- ─── Tekshirish: hech qayerda "Qoraqamish" qolmasligi kerak ───────────
SELECT 'MonthlyFinance' AS "jadval", COUNT(*) AS "qolgan"
  FROM "MonthlyFinance" WHERE "unit" = 'Qoraqamish'
UNION ALL SELECT 'Expense.unit', COUNT(*) FROM "Expense" WHERE "unit" = 'Qoraqamish'
UNION ALL SELECT 'Expense.title', COUNT(*) FROM "Expense" WHERE "title" LIKE '%Qoraqamish%'
UNION ALL SELECT 'Employee', COUNT(*) FROM "Employee" WHERE "unit" = 'Qoraqamish'
UNION ALL SELECT 'Sale', COUNT(*) FROM "Sale" WHERE "unit" = 'Qoraqamish'
UNION ALL SELECT 'Debt', COUNT(*) FROM "Debt" WHERE "unit" = 'Qoraqamish';


-- ─── Natija: yangi nom bilan nima borligini ko'rish ───────────────────
SELECT to_char("periodMonth", 'YYYY-MM') AS "oy", "unit",
       "turnover" / 1000000 AS "savdo_mln",
       "stockValue" / 1000000 AS "astatka_mln"
FROM "MonthlyFinance"
ORDER BY "periodMonth" DESC, "unit";
