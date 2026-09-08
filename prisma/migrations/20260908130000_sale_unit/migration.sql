-- Savdoni dorixonaga (Yunusobod / Qoraqamish) ajratish uchun.
-- Bo'sh (NULL) = hali ajratilmagan.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "unit" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Sale_unit_idx" ON "Sale"("unit");
