import crypto from "node:crypto";

export type TelegramMiniAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type TelegramAuthResult =
  | { ok: true; user: TelegramMiniAppUser }
  | { ok: false; error: string; status: number };

function adminIds() {
  return new Set(
    (process.env.TELEGRAM_ADMIN_IDS ?? "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter(Number.isSafeInteger),
  );
}

function timingSafeEqualHex(a: string, b: string) {
  const aa = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function verifyTelegramMiniApp(initData: string): TelegramAuthResult {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan", status: 500 };
  if (!initData) return { ok: false, error: "Telegram initData topilmadi", status: 401 };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "Telegram hash topilmadi", status: 401 };

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!timingSafeEqualHex(calculated, hash)) {
    return { ok: false, error: "Telegram imzosi noto'g'ri", status: 401 };
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  const maxAgeSeconds = 24 * 60 * 60;
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    return { ok: false, error: "Telegram sessiya muddati tugagan", status: 401 };
  }

  const rawUser = params.get("user");
  if (!rawUser) return { ok: false, error: "Telegram user topilmadi", status: 401 };

  let user: TelegramMiniAppUser;
  try {
    user = JSON.parse(rawUser) as TelegramMiniAppUser;
  } catch {
    return { ok: false, error: "Telegram user JSON noto'g'ri", status: 401 };
  }

  if (!adminIds().has(user.id)) {
    return { ok: false, error: "Bu panel faqat adminlar uchun", status: 403 };
  }

  return { ok: true, user };
}

export function getTelegramWebAppUrl() {
  const raw =
    process.env.TELEGRAM_WEBAPP_URL ||
    process.env.NEXT_PUBLIC_TELEGRAM_WEBAPP_URL ||
    process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return null;
  const trimmed = raw.replace(/\/$/, "");
  const base = trimmed.includes("/tg-admin") ? trimmed : `${trimmed}/tg-admin`;
  const version =
    process.env.VERCEL_URL ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    "latest";

  try {
    const url = new URL(base);
    url.searchParams.set("v", version);
    return url.toString();
  } catch {
    return base;
  }
}
