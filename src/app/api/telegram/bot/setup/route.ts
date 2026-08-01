import { Bot } from "grammy";
import { getTelegramWebAppUrl } from "@/lib/telegram-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminIds() {
  return (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Number.isSafeInteger);
}

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
  await bot.api.setWebhook(webhookUrl, { allowed_updates: ["message"] });
  await bot.api.setMyCommands(defaultCommands);

  const webAppUrl = getTelegramWebAppUrl() ?? new URL("/tg-admin", url.origin).toString();
  const adminCommandResults = await Promise.allSettled(
    adminIds().map((chatId) =>
      bot.api.setMyCommands(adminCommands, {
        scope: { type: "chat", chat_id: chatId },
      }),
    ),
  );
  const menuResults = await Promise.allSettled(
    adminIds().map((chatId) =>
      bot.api.setChatMenuButton({
        chat_id: chatId,
        menu_button: {
          type: "web_app",
          text: "Admin panel",
          web_app: { url: webAppUrl },
        },
      }),
    ),
  );

  return Response.json({
    ok: true,
    webhookUrl,
    webAppUrl,
    adminCommandsConfigured: adminCommandResults.filter((result) => result.status === "fulfilled").length,
    adminMenuConfigured: menuResults.filter((result) => result.status === "fulfilled").length,
  });
}
