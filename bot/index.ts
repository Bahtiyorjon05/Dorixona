import "dotenv/config";
import { Bot, Keyboard } from "grammy";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  SIGNUP_BONUS_POINTS,
  TIERS,
  makeCardCode,
  spentToNextTier,
  tierDiscount,
} from "../src/lib/loyalty";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error(
    "⚠️  TELEGRAM_BOT_TOKEN topilmadi.\n" +
      "   1. Telegram'da @BotFather ga yozing\n" +
      "   2. /newbot buyrug'i bilan bot yarating\n" +
      "   3. Olingan tokenni .env faylidagi TELEGRAM_BOT_TOKEN ga qo'ying\n" +
      "   4. Qayta ishga tushiring: npm run bot",
  );
  process.exit(0);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });
const bot = new Bot(token);

const som = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

// ─── /start — kutib olish va ro'yxatdan o'tish ───
bot.command("start", async (ctx) => {
  if (!ctx.from) return;
  const existing = await db.customer.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });

  if (existing) {
    await ctx.reply(
      `Xush kelibsiz, ${existing.fullName ?? "mijoz"}! 🌿\n\n` +
        `Sizning bonus kartangiz: ${existing.cardCode}\n` +
        `Balansingizni ko'rish uchun /balans buyrug'ini yuboring.`,
    );
    return;
  }

  const keyboard = new Keyboard()
    .requestContact("📱 Telefon raqamni ulashish")
    .resized()
    .oneTime();

  await ctx.reply(
    "Assalomu alaykum! Dorixona sodiqlik dasturiga xush kelibsiz 💊\n\n" +
      "Ro'yxatdan o'tish uchun telefon raqamingizni ulashing. " +
      `Sovg'a sifatida ${SIGNUP_BONUS_POINTS} ball va birinchi xaridingizga chegirma olasiz! 🎁`,
    { reply_markup: keyboard },
  );
});

// ─── Kontakt qabul qilish — ro'yxatdan o'tkazish ───
bot.on("message:contact", async (ctx) => {
  const contact = ctx.message.contact;
  const from = ctx.from;

  // Faqat o'z raqamini ulashishi mumkin
  if (contact.user_id && contact.user_id !== from.id) {
    await ctx.reply("Iltimos, o'zingizning raqamingizni ulashing.");
    return;
  }

  const phone = contact.phone_number.startsWith("+")
    ? contact.phone_number
    : `+${contact.phone_number}`;

  // Avval shu telefon yoki telegram bilan ro'yxatdan o'tganmi
  const already = await db.customer.findFirst({
    where: { OR: [{ phone }, { telegramId: BigInt(from.id) }] },
  });
  if (already) {
    await ctx.reply(
      `Siz allaqachon ro'yxatdan o'tgansiz ✅\n` +
        `Karta: ${already.cardCode} · Balans: ${already.points} ball`,
      { reply_markup: { remove_keyboard: true } },
    );
    return;
  }

  const count = await db.customer.count();
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const branch = await db.branch.findFirst({ where: { isActive: true } });

  const customer = await db.customer.create({
    data: {
      fullName: fullName || from.first_name,
      phone,
      telegramId: BigInt(from.id),
      telegramUser: from.username ?? null,
      cardCode: makeCardCode(101 + count),
      points: SIGNUP_BONUS_POINTS,
      tier: "BRONZE",
      branchId: branch?.id ?? null,
      loyaltyTransactions: {
        create: { type: "SIGNUP_BONUS", points: SIGNUP_BONUS_POINTS, note: "Ro'yxatdan o'tish bonusi" },
      },
    },
  });

  await ctx.reply(
    `Tabriklaymiz, ${customer.fullName}! Siz ro'yxatdan o'tdingiz 🎉\n\n` +
      `💳 Bonus karta: ${customer.cardCode}\n` +
      `🎁 Boshlang'ich bonus: ${SIGNUP_BONUS_POINTS} ball\n` +
      `🥉 Daraja: ${TIERS.BRONZE.label}\n\n` +
      `Endi har xaridingizda ball to'playsiz. Balans: /balans`,
    { reply_markup: { remove_keyboard: true } },
  );
});

// ─── /balans — ball va daraja ───
bot.command("balans", async (ctx) => {
  const customer = await db.customer.findUnique({
    where: { telegramId: BigInt(ctx.from!.id) },
  });
  if (!customer) {
    await ctx.reply("Siz hali ro'yxatdan o'tmagansiz. /start ni bosing.");
    return;
  }

  const spent = Number(customer.totalSpent);
  const tierInfo = TIERS[customer.tier];
  const next = spentToNextTier(spent);
  const nextLine = next
    ? `\n📈 ${TIERS[next.nextTier].label} darajasigacha: ${som(next.remaining)} so'm xarid`
    : "\n🏆 Siz eng yuqori darajadasiz!";

  await ctx.reply(
    `${tierInfo.emoji} ${customer.fullName ?? "Mijoz"}\n\n` +
      `💳 Karta: ${customer.cardCode}\n` +
      `⭐ Ballar: ${customer.points}\n` +
      `🏅 Daraja: ${tierInfo.label} (${tierDiscount(customer.tier)}% chegirma)\n` +
      `🛒 Jami xarid: ${som(spent)} so'm` +
      nextLine,
  );
});

// ─── /help ───
bot.command("help", async (ctx) => {
  await ctx.reply(
    "Dorixona sodiqlik boti 💊\n\n" +
      "/start — ro'yxatdan o'tish\n" +
      "/balans — bonus ballaringiz va daraja\n" +
      "/help — yordam",
  );
});

bot.catch((err) => console.error("Bot xatosi:", err));

bot.start({
  onStart: (info) => console.log(`🤖 Bot ishga tushdi: @${info.username}`),
});
