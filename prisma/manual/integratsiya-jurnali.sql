-- ═══════════════════════════════════════════════════════════════════════
--  IntegrationLog jadvali — F-Apteka nima yuborayotganini bazaga yozish
--
--  Nega kerak: Vercel Hobby tarifda loglar bir necha soatda o'chib
--  ketadi. SITE.exe kechasi push qilsa, ertalab logda hech narsa
--  qolmaydi. Bu jadval esa saqlanib turadi.
--
--  Supabase → SQL Editor → Run. Hech narsa o'chirilmaydi.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "IntegrationLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "keys" TEXT,
    "sample" TEXT,
    "note" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IntegrationLog_source_createdAt_idx"
    ON "IntegrationLog"("source", "createdAt");

-- Prisma migratsiya yozuvi
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '_prisma_migrations'
    ) THEN
        INSERT INTO "_prisma_migrations"
            (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
        SELECT
            gen_random_uuid()::text,
            '5f2967a88162e590e87dbf4b2e356872a570fb912ea39bbcdb5915a344d31836',
            now(), '20260908160000_integration_log', now(), 1
        WHERE NOT EXISTS (
            SELECT 1 FROM "_prisma_migrations"
            WHERE migration_name = '20260908160000_integration_log'
        );
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
--  KEYINCHALIK: F-Apteka nima yuborganini ko'rish uchun shuni Run qiling
-- ═══════════════════════════════════════════════════════════════════════
SELECT
    "createdAt",
    "rowCount"  AS "qatorlar",
    "note",
    "keys"      AS "kelgan_maydonlar",
    "sample"    AS "namuna_qator"
FROM "IntegrationLog"
ORDER BY "createdAt" DESC
LIMIT 20;
