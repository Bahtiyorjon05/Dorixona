import { Bot } from "grammy";
import { db } from "@/lib/db";
import { getTelegramWebAppUrl } from "@/lib/telegram-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminIds() {
  return (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Number.isSafeInteger);
}

/** Telegram'i bog'langan xodimlar ham tezkor buyruqlarni ko'rsin */
async function staffChatIds() {
  try {
    const users = await db.user.findMany({
      where: { isActive: true, telegramId: { not: null } },
      select: { telegramId: true },
    });
    return users.map((user) => Number(user.telegramId)).filter(Number.isSafeInteger);
  } catch {
    return [];
  }
}

const customerCommands = [
  { command: "start", description: "Ro'yxatdan o'tish" },
  { command: "balans", description: "Bonus ballari va daraja" },
  { command: "tarix", description: "So'nggi harakatlar" },
  { command: "help", description: "Yordam" },
];

const staffCommands = [
  { command: "panel", description: "To'liq panel (Mini App)" },
  { command: "qarzlar", description: "Ochiq qarzlar va muddatlar" },
  { command: "savdo", description: "Bugungi va oylik savdo" },
  { command: "ombor", description: "Kam qoldiq va muddat" },
  { command: "narxlar", description: "Narx nazorati" },
  { command: "hisobot", description: "Kunlik jamlanma" },
  { command: "id", description: "Telegram ID" },
  { command: "help", description: "Yordam" },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const setupKey = process.env.TELEGRAM_WEBHOOK_SETUP_KEY;
  if (!setupKey || url.searchParams.get("key") !== setupKey) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan" }, { status: 500 });
  }

  const bot = new Bot(token);
  const webhookUrl = new URL("/api/telegram/bot", url.origin).toString();
  // callback_query ham kerak — menyu tugmalari shu orqali ishlaydi
  await bot.api.setWebhook(webhookUrl, { allowed_updates: ["message", "callback_query"] });
  await bot.api.setMyCommands(customerCommands);

  const webAppUrl = getTelegramWebAppUrl() ?? new URL("/tg-admin", url.origin).toString();
  const admins = adminIds();
  const staff = (await staffChatIds()).filter((id) => !admins.includes(id));
  const panelChats = [...admins, ...staff];

  const commandResults = await Promise.allSettled(
    panelChats.map((chatId) =>
      bot.api.setMyCommands(staffCommands, { scope: { type: "chat", chat_id: chatId } }),
    ),
  );
  const menuResults = await Promise.allSettled(
    panelChats.map((chatId) =>
      bot.api.setChatMenuButton({
        chat_id: chatId,
        menu_button: {
          type: "web_app",
          text: "Panel",
          web_app: { url: webAppUrl },
        },
      }),
    ),
  );

  return Response.json({
    ok: true,
    webhookUrl,
    webAppUrl,
    adminlar: admins.length,
    xodimlar: staff.length,
    buyruqlarSozlandi: commandResults.filter((result) => result.status === "fulfilled").length,
    menyuSozlandi: menuResults.filter((result) => result.status === "fulfilled").length,
  });
}
