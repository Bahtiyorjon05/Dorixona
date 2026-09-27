-- ═══════════════════════════════════════════════════════════════════════
--  Integratsiya jurnali — sana bo'yicha indeks
--
--  Supabase → SQL Editor → to'liq qo'ying → Run
--
--  Bosh sahifa "oxirgi sinxronlash" yozuvini olganda butun jurnalni
--  ko'rib chiqmasin. XAVFSIZLIK: hech narsa o'chirilmaydi va
--  o'zgartirilmaydi; ikki marta Run bossangiz ham xato bermaydi.
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "IntegrationLog_createdAt_idx" ON "IntegrationLog" ("createdAt");
