# 🏥 Dorixona Platformasi (FarmaPlus)

Dorixona (apteka) tarmog'i uchun **boshqaruv platformasi** — moliya, ombor, xodimlar KPI tizimi, davomat nazorati va mijozlar bilan ishlash uchun **Telegram bot**.

> **Status:** 🟢 MVP ishlamoqda! Next.js + PostgreSQL to'liq stack qurildi: login, 8 ta sahifa (real ma'lumotlar bazasidan), POS kassa va Telegram bot. Boshlang'ich dizayn maketi `design/` papkasida saqlangan.

---

## ⚡ Tez ishga tushirish (Quick start)

Talablar: **Node.js 20+** va **PostgreSQL** o'rnatilgan bo'lishi kerak.

```bash
# 1. Paketlarni o'rnatish
npm install

# 2. .env faylini sozlash (DATABASE_URL ni o'z parolingizga moslang)
#    DATABASE_URL="postgresql://postgres:PAROL@localhost:5432/dorixona?schema=public"

# 3. Ma'lumotlar bazasini yaratish va jadvallarni qo'yish
npx prisma migrate dev

# 4. Namuna ma'lumotlar bilan to'ldirish
npm run db:seed

# 5. Dasturni ishga tushirish
npm run dev          # → http://localhost:3000

# 6. (ixtiyoriy) Telegram botni ishga tushirish
#    .env ga TELEGRAM_BOT_TOKEN ni qo'ygach:
npm run bot
```

**Test uchun kirish:** `admin@dorixona.uz` / `admin123`

### Asosiy `npm` buyruqlari
| Buyruq | Vazifasi |
|--------|----------|
| `npm run dev` | Dasturni dev rejimida ishga tushiradi |
| `npm run build` | Production build |
| `npm run db:seed` | Namuna ma'lumotlarni qayta yuklaydi |
| `npm run db:studio` | Prisma Studio (bazani ko'rish) |
| `npm run bot` | Telegram botni ishga tushiradi |

---

## 📑 Mundarija

- [Loyiha haqida](#-loyiha-haqida)
- [Hozirgi holat](#-hozirgi-holat)
- [Maqsadlar va talablar](#-maqsadlar-va-talablar)
- [Texnologiyalar (Tech stack)](#-texnologiyalar-tech-stack)
- [Arxitektura](#-arxitektura)
- [Telegram bot](#-telegram-bot)
- [Apteka dasturiga integratsiya](#-apteka-dasturiga-integratsiya)
- [Bonus / sodiqlik tizimi](#-bonus--sodiqlik-tizimi)
- [Rivojlanish bosqichlari (Roadmap)](#-rivojlanish-bosqichlari-roadmap)
- [Loyiha tuzilishi](#-loyiha-tuzilishi-rejalashtirilgan)
- [Ishga tushirish](#-ishga-tushirish)

---

## 📖 Loyiha haqida

FarmaPlus — dorixona egasi va menejerlari uchun **yagona boshqaruv tizimi**. Asosiy g'oya: savdo, ombor, xodimlar va mijozlarni bitta joyda kuzatish, KPI orqali xodimlarni adolatli baholash va Telegram bot orqali mijozlarni jalb qilib, sodiqlik bonuslari berish.

**Til:** Butun platforma va bot **sof o'zbek tilida** bo'ladi.

---

## 🔍 Hozirgi holat

`dorixona_platform_dashboard.html` — bitta statik HTML fayl:

- ✅ 7 ta sahifa dizayni tayyor: Moliya, Harajatlar, Ombor, Xodimlar, KPI, Davomat, Hisobotlar
- ✅ Chart.js grafiklari (savdo, toifalar, foyda, korrelyatsiya)
- ✅ KPI baholash tizimi konsepsiyasi (Savdo 40% + Marja 20% + Davomat 15% + Intizom 10% + Mijoz 15%)
- ❌ Backend yo'q — barcha ma'lumotlar qattiq yozilgan (hardcoded)
- ❌ Ma'lumotlar bazasi yo'q
- ❌ Foydalanuvchi autentifikatsiyasi yo'q
- ❌ Telegram bot yo'q
- ❌ Real interaktivlik yo'q (faqat sahifa almashtirish)

---

## 🎯 Maqsadlar va talablar

### Asosiy talablar
- [ ] **Ombor analitikasi** — chuqur tahlil: qoldiq dinamikasi, eng ko'p sotilgan dorilar, muddati tugashini bashorat qilish, ABC-tahlil, kam qoldiq ogohlantirishlari
- [ ] **Telegram bot** — mijozni taniydigan, ro'yxatdan o'tkazadigan bot
- [ ] **Mijoz ro'yxatdan o'tishi** — bot orqali oson registratsiya
- [ ] **Bonus tizimi** — ro'yxatdan o'tgan va xarid qilgan mijozga bonus/chegirma
- [ ] **Apteka dasturiga integratsiya** — mavjud POS/savdo dasturidan ma'lumot olish (texnik imkoniyat o'rganiladi)
- [ ] **Sof o'zbek tili** — butun interfeys va bot xabarlar o'zbekcha

### Backend (prototipni real qilish uchun)
- [ ] Ma'lumotlar bazasi (savdo, ombor, xodim, mijoz, KPI)
- [ ] REST/GraphQL API
- [ ] Autentifikatsiya va rollar (egasi / menejer / farmatsevt / kassir)
- [ ] Dashboard'ni real ma'lumotlar bilan ulash

---

## 🛠 Texnologiyalar (Tech stack)

> Quyidagilar **taklif** — birgalikda kelishib o'zgartirishimiz mumkin.

| Qatlam | Texnologiya | Izoh |
|--------|-------------|------|
| Frontend | React / Next.js + Chart.js | Mavjud HTML dizayni asos sifatida |
| Backend | Node.js (NestJS / Express) yoki Python (FastAPI) | API server |
| Ma'lumotlar bazasi | PostgreSQL | Asosiy ma'lumotlar |
| Telegram bot | `node-telegram-bot-api` / `grammY` yoki `aiogram` (Python) | Mijoz boti |
| Auth | JWT | Rollarga asoslangan kirish |
| Hosting | VPS / Railway / Render | Deploy |

---

## 🏗 Arxitektura

```
                    ┌──────────────────────┐
                    │   Dashboard (Web)     │
                    │  React / Next.js      │
                    └──────────┬───────────┘
                               │ REST API
                    ┌──────────▼───────────┐        ┌─────────────────┐
                    │     Backend API       │◄──────►│   PostgreSQL    │
                    │  (Node.js / FastAPI)  │        │   (ma'lumotlar)  │
                    └──────────┬───────────┘        └─────────────────┘
                               │
              ┌────────────────┼─────────────────┐
              │                │                 │
   ┌──────────▼─────┐  ┌───────▼────────┐  ┌─────▼──────────────┐
   │ Telegram bot   │  │  POS / Savdo   │  │  Analitika moduli  │
   │ (mijozlar)     │  │    moduli      │  │  (ombor, KPI)      │
   └────────────────┘  └────────────────┘  └────────────────────┘
```

---

## 🤖 Telegram bot

Mijozlar bilan ishlash uchun asosiy kanal.

### Funksiyalar
1. **Ro'yxatdan o'tish** — `/start` → ism + telefon raqami (Telegram kontakt orqali)
2. **Mijozni tanish** — telefon raqami yoki Telegram ID orqali takroriy mijozni aniqlash
3. **Bonus balansi** — mijoz o'z ballarini ko'radi
4. **Aksiyalar va eslatmalar** — yangi chegirmalar, dori kelishi haqida xabar
5. **Buyurtma / so'rov** — (kelajakda) dori mavjudligini so'rash

### Ro'yxatdan o'tish jarayoni (flow)
```
Mijoz → /start
Bot   → "Assalomu alaykum! Ro'yxatdan o'tish uchun telefon raqamingizni yuboring 📱"
Mijoz → [Kontakt ulashish tugmasi]
Bot   → "Rahmat! Siz ro'yxatdan o'tdingiz 🎉
         Sovg'a: birinchi xaridingizga 5% chegirma!
         Sizning bonus kartangiz: #FP-00123"
```

### Eslatma
- Mijoz ma'lumotlari (telefon) **shaxsiy ma'lumot** — ruxsat (consent) so'raladi va xavfsiz saqlanadi.

---

## 🔌 Apteka dasturiga integratsiya

> 🌸 ning savoli: *"Bzani apteka pragrammasiga integratsiya bo'ladimi?"*

**✅ Qaror:** Hozir dorixonada **alohida apteka dasturi yo'q**. Demak, tashqi integratsiya shart emas — biz **o'z savdo/POS modulimizni noldan quramiz**. Bu yanada qulay: hamma ma'lumot bitta tizimda bo'ladi, integratsiya muammolari bo'lmaydi.

| Holat | Yo'l |
|-------|------|
| **Hozir** | O'z POS / savdo modulimizni quramiz (ombor + savdo + mijoz bitta bazada) |
| Kelajakda boshqa dastur paydo bo'lsa | API yoki eksport orqali ulash imkoniyati qoldiriladi |

---

## 🎁 Bonus / sodiqlik tizimi

> 🌸: *"Ro'yxatdan o'tish uchun bonus qilish kerak."*

> **✅ Qaror:** Ikkala usul ham qo'llaniladi — **ball to'plash + daraja chegirmalari**.

### Model
- **Ro'yxatdan o'tish bonusi:** birinchi xaridga 5% chegirma + kirish ballari
- **Xarid ballari:** har 10 000 so'm xaridga 1 ball (sozlanadigan)
- **Ballarni ishlatish:** to'plangan ballarni keyingi xaridda chegirma sifatida
- **Darajalar (tier):** xarid hajmiga qarab mijoz darajasi oshadi, har darajada doimiy chegirma:
  | Daraja | Shart (jami xarid) | Doimiy chegirma |
  |--------|--------------------|-----------------|
  | 🥉 Bronza | 0+ | 0% (faqat ball) |
  | 🥈 Kumush | 500 000+ so'm | 3% |
  | 🥇 Oltin | 2 000 000+ so'm | 5% |
- **Tug'ilgan kun bonusi:** maxsus chegirma

### Texnik tomoni
- Har bir mijoz uchun `bonus_balance` ustuni
- Har xaridda ball qo'shish/ayirish tranzaksiyalari log qilinadi
- Bot orqali balansni ko'rish

---

## 🗺 Rivojlanish bosqichlari (Roadmap)

### 1-bosqich — Asos (MVP)
- [ ] GitHub repo yaratish va ulash
- [ ] Backend + PostgreSQL sxemasi
- [ ] Mavjud HTML dashboard'ni real API'ga ulash
- [ ] Autentifikatsiya (egasi / menejer)

### 2-bosqich — Ombor analitikasi
- [ ] Qoldiq dinamikasi grafiklari
- [ ] Eng ko'p / kam sotilgan dorilar
- [ ] Muddati tugashini bashorat qilish
- [ ] ABC-tahlil va kam qoldiq ogohlantirishlari

### 3-bosqich — Telegram bot
- [ ] Bot ro'yxatdan o'tkazish
- [ ] Mijozni tanish (telefon/ID)
- [ ] Bonus tizimi
- [ ] Aksiya eslatmalari

### 4-bosqich — POS / Savdo moduli
- [ ] Sotuv oynasi (kassir uchun): dori qidirish, savatcha, to'lov
- [ ] Har savdoda ombor qoldig'i avtomatik kamayadi
- [ ] Mijoz bonus ballari savdoga bog'lanadi

### 5-bosqich — Yaxshilash
- [ ] Hisobot eksporti (real xlsx/pdf/csv)
- [ ] AI tavsiyalar (real tahlil asosida)
- [ ] Mobil moslashuv (responsive)

---

## 📁 Loyiha tuzilishi (haqiqiy)

Monolit Next.js (full-stack) + ulashilgan Prisma bazasi:

```
Dorixona/
├── README.md
├── prisma/
│   ├── schema.prisma        # Ma'lumotlar bazasi sxemasi (barcha modellar)
│   ├── migrations/          # Migratsiyalar
│   └── seed.ts              # Namuna ma'lumotlar
├── src/
│   ├── app/
│   │   ├── login/           # Kirish sahifasi
│   │   ├── (dashboard)/     # Himoyalangan sahifalar (sidebar layout)
│   │   │   ├── moliya/  harajatlar/  ombor/  pos/
│   │   │   ├── xodimlar/  kpi/  davomat/  hisobotlar/
│   │   └── api/auth/        # NextAuth handler
│   ├── components/          # Sidebar, charts, UI, PosTerminal
│   ├── lib/
│   │   ├── db.ts            # Prisma client (pg adapter)
│   │   ├── queries.ts       # Bazadan analitik so'rovlar
│   │   ├── kpi.ts  loyalty.ts  format.ts
│   │   └── actions/         # Server actions (auth, pos)
│   ├── auth.ts  auth.config.ts  middleware.ts
│   └── generated/prisma/    # Prisma client (auto, git'ga kirmaydi)
├── bot/index.ts             # Telegram bot (grammY)
└── design/                  # Boshlang'ich HTML maket
```

---

## 🚀 Ishga tushirish

To'liq qo'llanma yuqoridagi [⚡ Tez ishga tushirish](#-tez-ishga-tushirish-quick-start) bo'limida.

Boshlang'ich HTML maketni ko'rish uchun: `design/dorixona_platform_dashboard.html` ni brauzerda oching.

---

## ✅ Qabul qilingan qarorlar

- **Apteka dasturi:** yo'q → o'z POS/savdo modulimizni noldan quramiz
- **Bonus tizimi:** ball to'plash + daraja chegirmalari (Bronza/Kumush/Oltin)
- **Filiallar:** hozircha **1 ta** (lekin baza ko'p filialga tayyor bo'lsin)

## 📝 Hali aniqlanishi kerak

1. Dashboard'dan kimlar foydalanadi (rollar: egasi / menejer / farmatsevt / kassir)?
2. Bot faqat mijozlar uchunmi yoki xodimlar uchun ham (masalan, davomat belgilash)?
3. Ball kursi va chegirma foizlari yakuniy shumi (yuqoridagi jadval) yoki o'zgartiramizmi?

---

*Bu reja boshlang'ich — birgalikda muhokama qilib to'ldiramiz.*
