import { Bot, InlineKeyboard, Keyboard, webhookCallback, type Context } from "grammy";
import { db } from "@/lib/db";
import {
  SIGNUP_BONUS_POINTS,
  TIERS,
  makeCardCode,
  spentToNextTier,
  tierDiscount,
} from "@/lib/loyalty";
import { getTelegramWebAppUrl } from "@/lib/telegram-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const som = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

function adminIds() {
  return new Set(
    (process.env.TELEGRAM_ADMIN_IDS ?? "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter(Number.isSafeInteger),
  );
}

function isAdmin(id?: number) {
  return id ? adminIds().has(id) : false;
}

async function requireAdmin(ctx: Context) {
  if (!ctx.from) return false;
  const admins = adminIds();
  if (admins.size === 0) {
    await ctx.reply(
      "Admin Mini App uchun Vercel env ichiga TELEGRAM_ADMIN_IDS qo'shing.\n" +
        `Sizning Telegram ID: ${ctx.from.id}`,
    );
    return false;
  }
  if (!admins.has(ctx.from.id)) {
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
        "Vercel env ichiga TELEGRAM_WEBAPP_URL qo'ying:\n" +
        "https://dorixonaa.vercel.app/tg-admin",
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

function registerBotHandlers(bot: Bot) {
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

  bot.on("message:contact", async (ctx) => {
    const contact = ctx.message.contact;
    const from = ctx.from;

    if (contact.user_id && contact.user_id !== from.id) {
      await ctx.reply("Iltimos, o'zingizning raqamingizni ulashing.");
      return;
    }

    const phone = contact.phone_number.startsWith("+")
      ? contact.phone_number
      : `+${contact.phone_number}`;

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

  bot.command(["admin", "panel", "dashboard"], sendAdminPanel);

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
}

let handler: ((req: Request) => Promise<Response>) | null = null;

function getWebhookHandler() {
  if (handler) return handler;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return async () => Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan" }, { status: 500 });
  }

  const bot = new Bot(token);
  registerBotHandlers(bot);
  bot.catch((err) => console.error("Telegram webhook xatosi:", err));
  handler = webhookCallback(bot, "std/http");
  return handler;
}

export async function POST(req: Request) {
  return getWebhookHandler()(req);
}

export async function GET() {
  return Response.json({ ok: true, mode: "telegram-webhook" });
}
