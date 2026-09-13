-- Xodim Telegram'ini akkauntga bog'lash uchun
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramId" BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramId_key" ON "User"("telegramId");
