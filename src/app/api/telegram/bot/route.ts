import { Bot, InlineKeyboard, Keyboard, webhookCallback, type Context } from "grammy";
import { db } from "@/lib/db";
import { adminChatIds, sendTelegram } from "@/lib/telegram/notify";
import {
  SIGNUP_BONUS_POINTS,
  TIERS,
  makeCardCode,
  spentToNextTier,
  tierDiscount,
} from "@/lib/loyalty";
import { getTelegramWebAppUrl } from "@/lib/telegram-auth";
import { readUserAccess } from "@/lib/permission-db";
import { PHONE_KEY_LENGTH, phoneKey } from "@/lib/phone";
import type { AppPermission } from "@/lib/permissions";
import {
  debtMessage,
  digestMessage,
  priceMessage,
  salesMessage,
  stockMessage,
} from "@/lib/telegram/digest";

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

/** Telegram'i akkauntga bog'langan faol xodimmi? */
async function linkedStaff(id?: number) {
  if (!id) return null;
  try {
    const user = await db.user.findUnique({
      where: { telegramId: BigInt(id) },
      select: { id: true, fullName: true, role: true, isActive: true },
    });
    return user && user.isActive ? user : null;
  } catch {
    return null;
  }
}

async function isLinkedStaff(id?: number) {
  return Boolean(await linkedStaff(id));
}

/**
 * Telefon raqami bo'yicha xodimni topadi.
 *
 * Raqam har xil yozilgan bo'lishi mumkin (+998, bo'shliq, qavs), shuning
 * uchun solishtirish faqat raqamlar bo'yicha va oxirgi 9 ta bilan ketadi.
 * Ishdan bo'shaganlar hisobga olinmaydi.
 */
async function employeeByPhone(phone: string) {
  const key = phoneKey(phone);
  if (!key) return null;
  try {
    const rows = await db.$queryRaw<
      { id: string; fullName: string; position: string; userId: string | null }[]
    >`
      SELECT e.id, e."fullName", e.position, e."userId"
      FROM "Employee" e
      WHERE e.phone IS NOT NULL
        AND e.status <> 'INACTIVE'
        AND RIGHT(regexp_replace(e.phone, '[^0-9]', '', 'g'), ${PHONE_KEY_LENGTH}) = ${key}
      LIMIT 1`;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Telegram'ni xodimning login akkauntiga bog'laydi.
 *
 * telegramId noyob maydon: o'sha ID boshqa akkauntda qolgan bo'lsa avval
 * bo'shatiladi, aks holda yozish xato beradi.
 */
async function linkTelegramToUser(userId: string, telegramId: number) {
  const id = BigInt(telegramId);
  await db.user.updateMany({ where: { telegramId: id, NOT: { id: userId } }, data: { telegramId: null } });
  await db.user.update({ where: { id: userId }, data: { telegramId: id } });
}

/**
 * Raqam xodimniki bo'lsa — panelni ochadi va mijoz sifatida
 * ro'yxatdan o'tkazmaydi. Xodim emas bo'lsa false qaytaradi.
 */
async function handleStaffPhone(ctx: Context, phone: string) {
  const employee = await employeeByPhone(phone);
  if (!employee || !ctx.from) return false;

  if (!employee.userId) {
    // Loginni faqat admin ochadi (Sozlamalar -> Xodimlar kirishi). Xodim o'zi
    // ro'yxatdan o'ta olmaydi — shuning uchun adminlarga xabar beramiz.
    await ctx.reply(
      `Salom, ${employee.fullName}! Siz Evomed apteka xodimi sifatida tanildingiz ✅\n\n` +
        `Lavozim: ${employee.position}\n\n` +
        "Panelga kirish uchun sizga login kerak — rahbariyatga xabar yuborildi. " +
        "Login ochilgach shu yerda yana /start bosing, panel o'zi ochiladi.",
      { reply_markup: { remove_keyboard: true } },
    );
    // Bitta xodim uchun kuniga bir marta — /start ni qayta bossa adminlar bezovta bo'lmasin
    const recent = await db.integrationLog
      .findFirst({
        where: { source: "xodim-login-sorov", note: employee.id, createdAt: { gte: new Date(Date.now() - 864e5) } },
        select: { id: true },
      })
      .catch(() => null);
    if (recent) return true;
    await db.integrationLog
      .create({ data: { source: "xodim-login-sorov", note: employee.id, ok: true } })
      .catch(() => null);
    const who = ctx.from.username ? ` (@${ctx.from.username})` : "";
    await sendTelegram(
      adminChatIds(),
      `👤 <b>Xodim botga kirdi, logini yo'q</b>\n\n` +
        `${employee.fullName} — ${employee.position}\nTelefon: ${phone}${who}\n\n` +
        "Saytda Sozlamalar → Xodimlar kirishi bo'limida unga login oching. " +
        "Keyin u botda /start bossa, panel o'zi ochiladi.",
    ).catch(() => null);
    return true;
  }

  try {
    await linkTelegramToUser(employee.userId, ctx.from.id);
  } catch (error) {
    console.error("Telegram xodimga bog'lanmadi:", error);
  }

  await ctx.reply(
    `Salom, ${employee.fullName}! Telegram akkauntingiz bog'landi ✅\n\n` +
      `Lavozim: ${employee.position}\n` +
      "Endi /start bosishning o'zi kifoya.",
    { reply_markup: { remove_keyboard: true } },
  );
  await sendAdminPanel(ctx);
  return true;
}

/** Panel ko'ra oladiganmi: admin yoki bog'langan xodim */
async function isStaff(id?: number) {
  return isAdmin(id) || (await isLinkedStaff(id));
}

/**
 * Buyruq uchun ruxsat tekshiruvi. Admin hammasini ko'radi; xodim faqat
 * o'ziga berilgan bo'limni. Ruxsat bo'lmasa qisqa javob qaytariladi.
 */
async function guard(ctx: Context, permission: AppPermission) {
  const id = ctx.from?.id;
  if (isAdmin(id)) return true;

  const user = await linkedStaff(id);
  if (!user) {
    await ctx.reply("Bu buyruq faqat dorixona xodimlari uchun. /start bosib kiring.");
    return false;
  }
  if (user.role === "OWNER") return true;

  const access = await readUserAccess(user.id, user.role);
  if (!access.permissions.includes(permission)) {
    await ctx.reply("Bu bo'limga ruxsatingiz yo'q. Ruxsatni admin beradi.");
    return false;
  }
  return true;
}

/** Mijozlar Mini App'i (/mijoz) — xodimlar paneli manzilidan olinadi */
function customerAppUrl() {
  const base = getTelegramWebAppUrl();
  if (!base) return null;
  try {
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/tg-admin\/?$/, "/mijoz");
    if (!url.pathname.endsWith("/mijoz")) url.pathname = "/mijoz";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Chat menyu tugmasi (pastki chapdagi). Eski sozlama ("Admin panel") chatda
 * saqlanib qoladi — har /start da shu odamga mos qilib qayta o'rnatamiz:
 * mijozga "Mening kartam", xodimga "Panel".
 */
async function setMenuButton(ctx: Context, kind: "customer" | "staff") {
  const chatId = ctx.chat?.id;
  const url = kind === "staff" ? getTelegramWebAppUrl() : customerAppUrl();
  if (!chatId || !url) return;
  try {
    await ctx.api.setChatMenuButton({
      chat_id: chatId,
      menu_button: { type: "web_app", text: kind === "staff" ? "Panel" : "🪪 Mening kartam", web_app: { url } },
    });
  } catch {
    // Menyu tugmasi o'rnatilmasa ham javob ketaversin
  }
}

/** "🪪 Mening kartam" tugmasi (Mini App sozlanmagan bo'lsa yo'q) */
function customerCardButton() {
  const url = customerAppUrl();
  return url ? new InlineKeyboard().webApp("🪪 Mening kartam", url) : undefined;
}

/** Mini App'ni kerakli bo'limda ochadigan havola */
function webAppUrl(section?: string) {
  const base = getTelegramWebAppUrl();
  if (!base || !section) return base;
  try {
    const url = new URL(base);
    url.searchParams.set("bolim", section);
    return url.toString();
  } catch {
    return base;
  }
}

/** Uzun javoblarni Telegram chegarasiga (4096) sig'dirib yuborish */
async function replyLong(ctx: Context, text: string, keyboard?: InlineKeyboard) {
  const limit = 3900;
  if (text.length <= limit) {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
    return;
  }

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const cut = rest.lastIndexOf("\n", limit);
    const at = cut > limit / 2 ? cut : limit;
    chunks.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  chunks.push(rest);

  for (let i = 0; i < chunks.length; i += 1) {
    await ctx.reply(chunks[i], {
      parse_mode: "HTML",
      reply_markup: i === chunks.length - 1 ? keyboard : undefined,
    });
  }
}

/** Klaviatura yorliqlari — matn kelganda shular bo'yicha tanib olinadi */
const MENU = {
  qarzlar: "🧮 Qarzlar",
  savdo: "🛒 Savdo",
  ombor: "📦 Ombor",
  narxlar: "💹 Narxlar",
  hisobot: "📊 Jamlanma",
  panel: "📱 To'liq panel",
} as const;

/** Yuborilgan matn menyu tugmasimi — emoji va katta-kichik harf farq qilmaydi */
function sectionFromText(text: string) {
  const clean = text
    .replace(/[^\p{L}\p{N}\s']/gu, "")
    .trim()
    .toLowerCase();
  if (!clean) return null;
  for (const [key, label] of Object.entries(MENU)) {
    const plain = label
      .replace(/[^\p{L}\p{N}\s']/gu, "")
      .trim()
      .toLowerCase();
    if (clean === plain) return key;
  }
  return null;
}

/** Bo'limni Mini App'da ochish tugmasi */
function openButton(label: string, section: string) {
  const url = webAppUrl(section);
  return url ? new InlineKeyboard().webApp(label, url) : undefined;
}

/**
 * Asosiy menyu — pastdagi doimiy klaviatura.
 *
 * Nega inline tugma emas: inline tugma bosilishi Telegram'ga
 * "callback_query" bo'lib keladi, u esa webhook "allowed_updates" ro'yxatida
 * bo'lmasa umuman yetib kelmaydi va tugma jim turadi. Pastki klaviatura esa
 * oddiy xabar yuboradi — u har doim keladi, hech qanday sozlash kerak emas.
 */
function mainMenu() {
  const keyboard = new Keyboard()
    .text(MENU.qarzlar)
    .text(MENU.savdo)
    .row()
    .text(MENU.ombor)
    .text(MENU.narxlar)
    .row()
    .text(MENU.hisobot)
    .resized()
    .persistent();

  // Mini App tugmasi ham shu klaviaturada tursin
  const url = webAppUrl();
  if (url) keyboard.row().webApp(MENU.panel, url);
  return keyboard;
}

async function sendAdminPanel(ctx: Context) {
  const url = getTelegramWebAppUrl();
  await setMenuButton(ctx, "staff");
  if (!url) {
    await ctx.reply(
      "Mini App URL sozlanmagan.\n\n" +
        "Vercel env ichiga TELEGRAM_WEBAPP_URL qo'ying:\n" +
        "https://dorixonaa.vercel.app/tg-admin",
    );
    return;
  }

  if (isAdmin(ctx.from?.id)) {
    await ctx.reply(
      "💊 <b>Evomed apteka — admin paneli</b>\n\n" +
        "Pastdagi tugmalardan foydalaning yoki buyruq yozing:\n" +
        "/qarzlar · /savdo · /ombor · /narxlar · /hisobot\n\n" +
        "To'liq panelda Moliya, Ombor, Savdo, Qarzlar, Narx nazorati, Mijozlar, " +
        "Xodimlar, KPI, Davomat va Hisobotlar bor.",
      { parse_mode: "HTML", reply_markup: mainMenu() },
    );
    return;
  }

  // Bog'langan xodim — to'g'ridan-to'g'ri panel
  const staff = await linkedStaff(ctx.from?.id);
  if (staff) {
    await ctx.reply(
      `Xush kelibsiz, ${staff.fullName}!\n\n` +
        "Pastdagi tugmalardan foydalaning — sizga berilgan bo'limlar ochiladi.",
      { reply_markup: mainMenu() },
    );
    return;
  }

  // Hali bog'lanmagan — bir marta email/parol bilan kirsa, Telegram'i bog'lanadi
  const keyboard = new InlineKeyboard().webApp("Xodim sifatida kirish", url);
  await ctx.reply(
    "Bu bo'lim faqat xodimlar uchun.\n\n" +
      "Agar xodim bo'lsangiz — email va parolingiz bilan kiring, Telegram'ingiz akkauntga bog'lanadi. " +
      "Keyingi safar /start bosishning o'zi kifoya.\n\n" +
      "Mijoz bo'lsangiz: /balans — bonus ballari, /tarix — xaridlar.",
    { reply_markup: keyboard },
  );
}

/** Buyruq va tugma bir xil ishlashi uchun umumiy ro'yxat */
const sections: {
  key: string;
  permission: AppPermission;
  label: string;
  section: string;
  text: () => Promise<string>;
}[] = [
  { key: "qarzlar", permission: "qarzlar", label: "Qarzlarni ochish", section: "debts", text: debtMessage },
  { key: "savdo", permission: "savdo", label: "Savdoni ochish", section: "sales", text: salesMessage },
  { key: "ombor", permission: "ombor", label: "Omborni ochish", section: "inventory", text: stockMessage },
  { key: "narxlar", permission: "narxlar", label: "Narxlarni ochish", section: "prices", text: priceMessage },
  { key: "hisobot", permission: "moliya", label: "Panelni ochish", section: "overview", text: digestMessage },
];

async function sendSection(ctx: Context, key: string) {
  const item = sections.find((s) => s.key === key);
  if (!item) return;
  if (!(await guard(ctx, item.permission))) return;
  try {
    const text = await item.text();
    await replyLong(ctx, text, openButton(item.label, item.section));
  } catch (error) {
    console.error(`Telegram /${key} xatosi:`, error);
    await ctx.reply("Ma'lumot olinmadi. Birozdan keyin qayta urinib ko'ring.");
  }
}

function registerBotHandlers(bot: Bot) {
  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    // Admin yoki bog'langan xodim — panel. Mijozlar bu tarmoqqa tushmaydi.
    if (await isStaff(ctx.from.id)) {
      await sendAdminPanel(ctx);
      return;
    }

    const existing = await db.customer.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
    });

    if (existing) {
      // Xodim avval mijoz bo'lib yozilgan bo'lishi mumkin — raqamiga qarab
      // xodimligi aniqlansa, panel ochiladi
      if (await handleStaffPhone(ctx, existing.phone)) return;
      await setMenuButton(ctx, "customer");

      await ctx.reply(
        `Xush kelibsiz, ${existing.fullName ?? "mijoz"}! 🌿\n\n` +
          `Sizning bonus kartangiz: ${existing.cardCode}\n` +
          `Karta, ballar va dori qidirish — pastdagi tugmada.`,
        { reply_markup: customerCardButton() },
      );
      return;
    }

    const keyboard = new Keyboard()
      .requestContact("📱 Telefon raqamni ulashish")
      .resized()
      .oneTime();

    await ctx.reply(
      "Assalomu alaykum! Evomed apteka sodiqlik dasturiga xush kelibsiz 💊\n\n" +
        "Ro'yxatdan o'tish uchun telefon raqamingizni ulashing. " +
        `Sovg'a sifatida ${SIGNUP_BONUS_POINTS} ball va birinchi xaridingizga chegirma olasiz! 🎁\n\n` +
        "Dorixona xodimi bo'lsangiz ham shu tugmani bosing — raqamingizdan " +
        "tanib, panelni ochamiz.",
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

    // Raqam ERP dagi xodimniki bo'lsa — mijoz emas, xodim sifatida kiradi
    if (await handleStaffPhone(ctx, phone)) return;

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
    await setMenuButton(ctx, "customer");
    const button = customerCardButton();
    if (button) await ctx.reply("Kartangiz, ballaringiz va dori qidirish:", { reply_markup: button });
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
    await setMenuButton(ctx, "customer");
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
      { reply_markup: customerCardButton() },
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

  bot.command(["admin", "panel", "dashboard", "menyu"], sendAdminPanel);

  // ─── Xodim/admin buyruqlari ───
  bot.command("qarzlar", (ctx) => sendSection(ctx, "qarzlar"));
  bot.command("savdo", (ctx) => sendSection(ctx, "savdo"));
  bot.command("ombor", (ctx) => sendSection(ctx, "ombor"));
  bot.command("narxlar", (ctx) => sendSection(ctx, "narxlar"));
  bot.command("hisobot", (ctx) => sendSection(ctx, "hisobot"));

  // Pastki klaviatura tugmalari oddiy matn bo'lib keladi
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return next();

    const key = sectionFromText(text);
    if (!key || key === "panel") return next();
    if (!(await isStaff(ctx.from?.id))) return next();

    await sendSection(ctx, key);
  });

  // Eski xabarlardagi inline tugmalar ham ishlayversin
  bot.callbackQuery(/^m:(.+)$/, async (ctx) => {
    const key = ctx.match?.[1];
    await ctx.answerCallbackQuery();
    if (key) await sendSection(ctx, key);
  });

  bot.command("id", async (ctx) => {
    await ctx.reply(
      `Sizning Telegram ID: <code>${ctx.from?.id}</code>\n\n` +
        "Admin bo'lish uchun shu raqamni Vercel env ichidagi TELEGRAM_ADMIN_IDS ga qo'shish kerak.",
      { parse_mode: "HTML" },
    );
  });

  bot.command("help", async (ctx) => {
    if (await isStaff(ctx.from?.id)) {
      await ctx.reply(
        "💊 <b>Evomed apteka boti</b>\n\n" +
          "<b>Tezkor buyruqlar</b>\n" +
          "/qarzlar — ochiq qarzlar va muddatlar\n" +
          "/savdo — bugungi va oylik savdo, naqd/karta\n" +
          "/ombor — kam qoldiq va muddati yaqin dorilar\n" +
          "/narxlar — raqobatchidan qimmat turgan dorilar\n" +
          "/hisobot — kunlik jamlanma\n" +
          "/panel — to'liq Mini App\n" +
          "/id — Telegram ID\n\n" +
          "Shu buyruqlar pastdagi tugmalarda ham turadi.\n" +
          "Qarz muddati 10 kundan kam qolsa bot o'zi ogohlantiradi.",
        { parse_mode: "HTML", reply_markup: mainMenu() },
      );
      return;
    }

    await ctx.reply(
      "Dorixona sodiqlik boti 💊\n\n" +
        "/start — ro'yxatdan o'tish\n" +
        "/balans — bonus ballaringiz va daraja\n" +
        "/tarix — so'nggi harakatlar\n" +
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
