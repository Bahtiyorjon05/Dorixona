-- Pereotsenka avtomatik: SITE.exe narxlaridan hisoblanadi.
-- Supabase → SQL Editor → Run. Xavfsiz: qayta ishga tushirsa hech narsa buzilmaydi.

CREATE TABLE IF NOT EXISTS "FaptekaPrice" (
    "otdel"     TEXT NOT NULL,
    "fid"       TEXT NOT NULL,
    "price"     DECIMAL(16,2) NOT NULL,
    "qty"       DECIMAL(14,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FaptekaPrice_pkey" PRIMARY KEY ("otdel", "fid")
);

CREATE TABLE IF NOT EXISTS "Revaluation" (
    "id"       TEXT NOT NULL,
    "unit"     TEXT NOT NULL,
    "otdel"    TEXT NOT NULL,
    "fid"      TEXT NOT NULL,
    "name"     TEXT NOT NULL,
    "oldPrice" DECIMAL(16,2) NOT NULL,
    "newPrice" DECIMAL(16,2) NOT NULL,
    "qty"      DECIMAL(14,4) NOT NULL,
    "amount"   DECIMAL(16,2) NOT NULL,
    "at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Revaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Revaluation_unit_at_idx" ON "Revaluation" ("unit", "at");

-- Tekshirish: oylar bo'yicha pereotsenka (mln)
SELECT to_char("at" + interval '5 hours', 'YYYY-MM') AS "oy", "unit",
       COUNT(*) AS "hujjat", ROUND(SUM("amount") / 1000000, 2) AS "summa_mln"
FROM "Revaluation"
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
