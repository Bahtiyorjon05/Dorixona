-- ═══════════════════════════════════════════════════════════════════════
--  "Oldingi oydan" tugmasi bilan iyuldan avgustga tasodifan ko'chirilgan
--  harajatlarni o'chirish.
--
--  IKKI QADAMDA BAJARING. Avval 1-qismni Run qiling va ro'yxatni ko'ring.
--  Faqat ishonch hosil qilgandan keyin 2-qismni Run qiling.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1-QISM: NIMA O'CHIRILISHINI KO'RISH (avval shuni Run qiling) ─────
--  Bu faqat ko'rsatadi, hech narsa o'chirmaydi.
--
--  Qanday topiladi: avgustdagi shu yozuv iyuldagi "Doimiy" yozuv bilan
--  nomi va dorixonasi bo'yicha bir xil bo'lsa — demak ko'chirilgan.
--
--  TEKSHIRING:
--   • soni ~14 tami?
--   • "createdAt" ustuni — hammasi bir xil vaqtda yaratilganmi?
--     (tugmani bir marta bosgansiz, demak hammasi bir daqiqada)
--   • ro'yxatda O'ZINGIZ kiritgan avgust yozuvlari YO'Qmi?
--     ("Ijara — Qoraqamish", "Oylik — Dilnoz", "QQS (NDS)" va h.k.
--      bo'lmasligi kerak)
SELECT
    a."createdAt",
    a."title"                    AS "nomi",
    COALESCE(a."unit", 'Umumiy')  AS "dorixona",
    a."category"                 AS "toifa",
    a."amount" / 1000000         AS "summa_mln",
    a."spentAt"
FROM "Expense" a
WHERE a."spentAt" >= TIMESTAMP '2026-08-01 00:00:00'
  AND a."spentAt" <  TIMESTAMP '2026-09-01 00:00:00'
  AND EXISTS (
      SELECT 1 FROM "Expense" j
      WHERE j."isRecurring" = true
        AND j."spentAt" >= TIMESTAMP '2026-07-01 00:00:00'
        AND j."spentAt" <  TIMESTAMP '2026-08-01 00:00:00'
        AND j."title" = a."title"
        AND COALESCE(j."unit", '') = COALESCE(a."unit", '')
  )
ORDER BY a."createdAt" DESC, a."title";


-- ─── 2-QISM: O'CHIRISH ────────────────────────────────────────────────
--  1-qismdagi ro'yxat to'g'ri bo'lsa, quyidagi qatorlardan
--  boshidagi "--" belgilarini olib tashlang va Run bosing.
--
--  Shart 1-qism bilan bir xil — ya'ni yuqorida ko'rgan qatorlaringiz
--  o'chadi, boshqasi emas.

-- DELETE FROM "Expense" a
-- WHERE a."spentAt" >= TIMESTAMP '2026-08-01 00:00:00'
--   AND a."spentAt" <  TIMESTAMP '2026-09-01 00:00:00'
--   AND EXISTS (
--       SELECT 1 FROM "Expense" j
--       WHERE j."isRecurring" = true
--         AND j."spentAt" >= TIMESTAMP '2026-07-01 00:00:00'
--         AND j."spentAt" <  TIMESTAMP '2026-08-01 00:00:00'
--         AND j."title" = a."title"
--         AND COALESCE(j."unit", '') = COALESCE(a."unit", '')
--   );


-- ─── 3-QISM: NATIJANI TEKSHIRISH ──────────────────────────────────────
--  O'chirgandan keyin avgustda nechta yozuv qolganini ko'rish.
--  Sizning SQL bilan kiritganingiz 20 ta edi (19 + Otabek aka bank).
SELECT
    COUNT(*)                 AS "yozuv_soni",
    SUM("amount") / 1000000  AS "jami_mln"
FROM "Expense"
WHERE "spentAt" >= TIMESTAMP '2026-08-01 00:00:00'
  AND "spentAt" <  TIMESTAMP '2026-09-01 00:00:00';
