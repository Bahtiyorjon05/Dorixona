-- Xodimni dorixona birligiga (filial) boglash: Yunusobod / Qoraqamish
ALTER TABLE "Employee" ADD COLUMN "unit" TEXT;
CREATE INDEX "Employee_unit_idx" ON "Employee"("unit");
