-- Tovar -> yetkazib beruvchi (Analitika: yetkazib beruvchilar bo'yicha qoldiq).
-- Relay F-Apteka kirim qatorlaridan (INCOMELN.ORG) har tovarning oxirgi
-- yetkazib beruvchisini yozadi. Ustun Prisma sxemasida ataylab yo'q:
-- SQL ishga tushirilmaguncha ham tovar sahifalari ishlayveradi.
-- Supabase -> SQL Editor -> Run. Qayta ishga tushirsa ham xavfsiz.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierOrg" TEXT;

-- Tekshirish (relay yuborgandan keyin to'ladi)
SELECT COUNT(*) FILTER (WHERE "supplierOrg" IS NOT NULL) AS yetkazib_beruvchisi_bor, COUNT(*) AS jami
FROM "Product" WHERE "sku" LIKE 'FA:%';
