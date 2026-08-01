import { readFileSync } from "node:fs";
import { config as loadEnv, parse as parseEnv } from "dotenv";
import { Bot, InlineKeyboard, Keyboard, type Context } from "grammy";
import { PrismaClient } from "../src/generated/prisma/client";
import { getTelegramWebAppUrl } from "../src/lib/telegram-auth";
import { createPrismaPgAdapter } from "../src/lib/postgres";
import {
  SIGNUP_BONUS_POINTS,
  TIERS,
  makeCardCode,
  spentToNextTier,
  tierDiscount,
} from "../src/lib/loyalty";

loadEnv();
try {
  const localEnv = parseEnv(readFileSync(".env.local"));
  for (const [key, value] of Object.entries(localEnv)) {
    if (value) process.env[key] = value;
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

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

const adapter = createPrismaPgAdapter();
const db = new PrismaClient({ adapter });
const bot = new Bot(token);

const som = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");
const defaultCommands = [
  { command: "start", description: "Ro'yxatdan o'tish" },
  { command: "balans", description: "Bonus ballari va daraja" },
  { command: "tarix", description: "So'nggi harakatlar" },
  { command: "help", description: "Yordam" },
];
const adminCommands = [
  ...defaultCommands,
  { command: "panel", description: "Admin Mini App" },
  { command: "admin", description: "Admin panel" },
];
const adminIds = new Set(
  (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Number.isSafeInteger),
);

function isAdmin(id?: number) {
  return id ? adminIds.has(id) : false;
}

async function requireAdmin(ctx: Context) {
  if (!ctx.from) return false;
  if (adminIds.size === 0) {
    await ctx.reply(
      "Admin Mini App uchun .env faylga TELEGRAM_ADMIN_IDS qo'shing.\n" +
        `Sizning Telegram ID: ${ctx.from.id}`,
    );
    return false;
  }
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply("Bu panel faqat adminlar uchun.");
    return false;
  }
  return true;
}

async function sendAdminPanel(ctx: Context) {
  const url = getTelegramWebAppUrl();
  if (!url) {
    await ctx.reply(
      "Mini App URL sozlanmagan.\n\n" +
        ".env yoki Vercel env ichiga TELEGRAM_WEBAPP_URL qo'ying:\n" +
        "https://your-project.vercel.app/tg-admin",
    );
    return;
  }

  if (isAdmin(ctx.from?.id)) {
    const keyboard = new InlineKeyboard().webApp("Admin panelni ochish", url);
    await ctx.reply(
      "Dorixona admin Mini App tayyor.\n\n" +
        "Web ilovadagi Moliya, Ombor, Savdo, Mijozlar, Xodimlar, KPI, Davomat, Hisobotlar va Sozlamalar shu panel ichida ko'rinadi.",
      { reply_markup: keyboard },
    );
    return;
  }

  const keyboard = new InlineKeyboard().webApp("Xodim Mini Appga kirish", url);
  await ctx.reply(
    "Bu oynadan xodimlar email va parol bilan kiradi.\n\n" +
      "Oddiy mijozlar uchun /balans va /tarix ishlaydi. Xodim ekaningiz login orqali tekshiriladi.",
    { reply_markup: keyboard },
  );
}

async function setupAdminMenuButton() {
  const url = getTelegramWebAppUrl();
  if (adminIds.size === 0) return;

  await Promise.allSettled(
    [...adminIds].map((chatId) =>
      bot.api.setMyCommands(adminCommands, {
        scope: { type: "chat", chat_id: chatId },
      }),
    ),
  );
  if (!url) return;

  const results = await Promise.allSettled(
    [...adminIds].map((chatId) =>
      bot.api.setChatMenuButton({
        chat_id: chatId,
        menu_button: {
          type: "web_app",
          text: "Admin panel",
          web_app: { url },
        },
      }),
    ),
  );
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed) console.warn(`Admin menu button ${failed} ta admin uchun sozlanmadi.`);
}

// ─── /start — kutib olish va ro'yxatdan o'tish ───
bot.command("start", async (ctx) => {
  if (!ctx.from) return;
  if (isAdmin(ctx.from.id)) {
    await sendAdminPanel(ctx);
    return;
  }

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

// ─── /tarix — so'nggi harakatlar ───
bot.command("tarix", async (ctx) => {
  const customer = await db.customer.findUnique({
    where: { telegramId: BigInt(ctx.from!.id) },
    include: { loyaltyTransactions: { orderBy: { createdAt: "desc" }, take: 8 } },
  });
  if (!customer) {
    await ctx.reply("Siz hali ro'yxatdan o'tmagansiz. /start ni bosing.");
    return;
  }
  if (customer.loyaltyTransactions.length === 0) {
    await ctx.reply("Hali harakatlar yo'q. Birinchi xaridingizdan keyin shu yerda ko'rinadi.");
    return;
  }

  const LABEL: Record<string, string> = {
    EARN: "🛒 Xariddan",
    REDEEM: "💸 Ishlatildi",
    SIGNUP_BONUS: "🎁 Ro'yxat bonusi",
    ADJUST: "🔧 Tuzatish",
  };
  const lines = customer.loyaltyTransactions.map((t) => {
    const d = t.createdAt.toLocaleDateString("uz-UZ");
    const sign = t.points >= 0 ? "+" : "";
    return `${d} · ${LABEL[t.type] ?? t.type}: ${sign}${t.points} ball`;
  });

  await ctx.reply(`🕘 So'nggi harakatlar:\n\n${lines.join("\n")}\n\nJoriy balans: ${customer.points} ball`);
});

// ─── Admin Mini App ───
bot.command(["admin", "panel", "dashboard"], sendAdminPanel);

// ─── /help ───
bot.command("help", async (ctx) => {
  const adminLine = isAdmin(ctx.from?.id) ? "/panel — admin Mini App\n" : "";
  await ctx.reply(
    "Dorixona sodiqlik boti 💊\n\n" +
      "/start — ro'yxatdan o'tish\n" +
      "/balans — bonus ballaringiz va daraja\n" +
      "/tarix — so'nggi harakatlar\n" +
      adminLine +
      "/help — yordam",
  );
});

// Bot buyruqlari menyusi
void bot.api.setMyCommands(defaultCommands);

bot.catch((err) => console.error("Bot xatosi:", err));

void setupAdminMenuButton();

bot.start({
  onStart: (info) => console.log(`🤖 Bot ishga tushdi: @${info.username}`),
});
