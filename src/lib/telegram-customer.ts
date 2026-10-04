import "server-only";
import { verifyTelegramSignature } from "@/lib/telegram-auth";

/**
 * Mijozlar Mini App'i: so'rov Telegram ichidan kelganini tekshiradi.
 * Sarlavha: Authorization: tma <initData>. Admin bo'lish shart emas —
 * har qanday Telegram foydalanuvchisi o'z kartasini ko'radi.
 */
export function telegramUserFrom(request: Request) {
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const initData = auth.toLowerCase().startsWith("tma ") ? auth.slice(4).trim() : "";
  return verifyTelegramSignature(initData);
}
