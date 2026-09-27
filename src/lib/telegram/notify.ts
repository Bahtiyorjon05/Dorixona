import "server-only";
import { db } from "@/lib/db";
import { readUserAccess } from "@/lib/permission-db";
import type { AppPermission } from "@/lib/permissions";
import { getTelegramWebAppUrl } from "@/lib/telegram-auth";

/**
 * Telegram'ga xabar yuborish — bot va eslatmalar shu moduldan foydalanadi.
 *
 * Kim oladi: TELEGRAM_ADMIN_IDS ichidagi adminlar + Telegram'i bog'langan
 * xodimlar (faqat o'sha bo'limga ruxsati bo'lsa). Shu sababli qarz eslatmasi
 * qarzlar bo'limiga ruxsati borlarga ketadi, kassirga emas.
 */

export type Recipient = {
  chatId: string;
  name: string;
  source: "admin" | "xodim";
};

export type SendOutcome = { chatId: string; ok: boolean; error?: string };

export function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

/** env dagi admin ID lar */
export function adminChatIds() {
  return (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^-?\d+$/.test(id));
}

/** Shu bo'limga ruxsati bor va Telegram'i bog'langan xodimlar + adminlar */
export async function recipientsFor(permission: AppPermission): Promise<Recipient[]> {
  const list: Recipient[] = adminChatIds().map((chatId) => ({
    chatId,
    name: "Admin",
    source: "admin" as const,
  }));
  const seen = new Set(list.map((r) => r.chatId));

  try {
    const users = await db.user.findMany({
      where: { isActive: true, telegramId: { not: null } },
      select: { id: true, fullName: true, role: true, telegramId: true },
    });
    for (const user of users) {
      const chatId = String(user.telegramId);
      if (seen.has(chatId)) continue;
      const access = await readUserAccess(user.id, user.role);
      if (user.role !== "OWNER" && !access.permissions.includes(permission)) continue;
      seen.add(chatId);
      list.push({ chatId, name: user.fullName, source: "xodim" });
    }
  } catch {
    // Baza o'qilmasa ham adminlarga ketaversin
  }

  return list;
}

type SendOptions = {
  /** Mini App'ni ochadigan tugma matni; bo'lmasa tugma qo'yilmaydi */
  buttonText?: string;
  /** Mini App ichidagi bo'lim, masalan "debts" */
  section?: string;
  /** Mini App o'rniga oddiy havola */
  url?: string;
};

function replyMarkup(options?: SendOptions) {
  if (!options?.buttonText) return undefined;

  if (options.url) {
    return { inline_keyboard: [[{ text: options.buttonText, url: options.url }]] };
  }

  const base = getTelegramWebAppUrl();
  if (!base) return undefined;
  let url = base;
  if (options.section) {
    try {
      const parsed = new URL(base);
      parsed.searchParams.set("bolim", options.section);
      url = parsed.toString();
    } catch {
      // URL noto'g'ri bo'lsa asl havola qoladi
    }
  }
  return { inline_keyboard: [[{ text: options.buttonText, web_app: { url } }]] };
}

/** Bir nechta chatga yuboradi; xatosi bilan natijani qaytaradi */
export async function sendTelegram(
  chatIds: string[],
  text: string,
  options?: SendOptions,
): Promise<SendOutcome[]> {
  const token = botToken();
  if (!token) {
    return chatIds.map((chatId) => ({ chatId, ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan" }));
  }

  const markup = replyMarkup(options);
  const results: SendOutcome[] = [];

  for (const chatId of chatIds) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          ...(markup ? { reply_markup: markup } : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
      if (response.ok && body?.ok) {
        results.push({ chatId, ok: true });
      } else {
        // Telegram sababini aytadi: "chat not found", "bot was blocked" va h.k.
        results.push({ chatId, ok: false, error: body?.description ?? `HTTP ${response.status}` });
      }
    } catch (error) {
      results.push({ chatId, ok: false, error: error instanceof Error ? error.message : "yuborilmadi" });
    }
  }

  return results;
}
