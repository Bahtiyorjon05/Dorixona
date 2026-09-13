-- User.telegramId — xodim Telegram bog'lash uchun
-- Supabase SQL Editor -> Run
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramId" BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramId_key" ON "User"("telegramId");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations') THEN
    INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
    SELECT gen_random_uuid()::text,
      'ab079dc939c41b9d0913e143f77eae9ca794025fe0803a1a6b0aa465cd22a7d0',
      now(), '20260913120000_user_telegram', now(), 1
    WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260913120000_user_telegram');
  END IF;
END $$;
