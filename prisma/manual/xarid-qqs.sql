-- Xarid QQS stavkasi — foyda F-Apteka'dagi kabi aniq chiqishi uchun.
--
-- Ba'zi yetkazib beruvchilar QQSsiz ishlaydi. F-Apteka foydadan
-- "НДС продажи − НДС прихода" ni ayiradi; xarid QQSini bilmasak, hamma
-- xaridni 12% deb olishga to'g'ri keladi va foyda oshib chiqadi.
--
-- Stavka kirim hisobotidan (1-hisobot: SN / SP) har tovar uchun yoziladi.
-- Ustun Prisma sxemasida ataylab yo'q: bu SQL ishga tushirilmaguncha ham
-- tovar sahifalari ishlayveradi (stavka noma'lum = 12%).
--
-- Supabase → SQL Editor → Run. Qayta ishga tushirsa ham xavfsiz.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "purchaseVatRate" DECIMAL(5,4);

-- Tekshirish (ko'prik skript kirimlarni yuborgandan keyin to'ladi)
SELECT
  COUNT(*) FILTER (WHERE "purchaseVatRate" IS NOT NULL) AS stavkasi_bor,
  COUNT(*) FILTER (WHERE "purchaseVatRate" = 0)         AS qqssiz,
  COUNT(*) FILTER (WHERE "purchaseVatRate" > 0)         AS qqs_bilan
FROM "Product" WHERE "sku" LIKE 'FA:%';
