-- Kassir smenasidagi sotilgan tovarning tan narxi — KPI "Marja" uchun.
-- Relay v23 yuboradi (KOL x INCOMELN.PRICESKID, 22-hisobot bilan bir xil).
-- Ustun Prisma sxemasida ataylab yo'q: bu SQL ishga tushirilmaguncha ham
-- smenalar va KPI ishlayveradi (marja o'rniga o'rtacha chek olinadi).
--
-- Supabase → SQL Editor → Run. Qayta ishga tushirsa ham xavfsiz.

ALTER TABLE "CashierShift" ADD COLUMN IF NOT EXISTS "cost" DECIMAL(16,2);

-- Tekshirish (relay v23 smenalarni yuborgandan keyin to'ladi)
SELECT "unit", COUNT(*) AS smena, COUNT("cost") AS tan_narxi_bor,
       ROUND(SUM("sales" - "returns")) AS savdo, ROUND(SUM("cost")) AS tan_narx
FROM "CashierShift" WHERE "day" >= date_trunc('month', now())
GROUP BY "unit";
