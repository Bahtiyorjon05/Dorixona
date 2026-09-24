import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Qarz muddati eslatmasi — kuniga bir marta Telegram'ga yuboriladi.
 *
 * Vercel Cron chaqiradi (vercel.json). Qo'lda tekshirish uchun:
 *   /api/notifications/debts?token=<FAPTEKA_SITE_TOKEN>
 *
 * Kim oladi: TELEGRAM_ADMIN_IDS ichidagi adminlar.
 */

const DUE_SOON_DAYS = 5;

function allowed(request: NextRequest) {
  // Vercel Cron o'z sarlavhasini qo'yadi; qo'lda chaqirilsa token so'raladi
  if (request.headers.get("x-vercel-cron")) return true;

  const expected = process.env.CRON_SECRET?.trim() || process.env.FAPTEKA_SITE_TOKEN?.trim();
  if (!expected) return false;

  const auth = request.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return bearer === expected || request.nextUrl.searchParams.get("token")?.trim() === expected;
}

function money(amount: number, currency: string) {
  const rounded = Math.round(amount);
  return currency === "USD"
    ? `$${rounded.toLocaleString("ru-RU").replace(/,/g, " ")}`
    : `${rounded.toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
}

async function sendToAdmins(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const admins = (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!token || !admins.length) return 0;

  let sent = 0;
  for (const chatId of admins) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (response.ok) sent += 1;
    } catch {
      // Bitta admin olmasa ham qolganlariga ketaversin
    }
  }
  return sent;
}

async function handle(request: NextRequest) {
  if (!allowed(request)) {
    return NextResponse.json({ ok: false, error: "Token noto'g'ri" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const edge = new Date(today.getTime() + DUE_SOON_DAYS * 864e5);

  const debts = await db.debt.findMany({
    where: { closedAt: null, dueDate: { not: null, lte: edge } },
    orderBy: { dueDate: "asc" },
    select: { counterparty: true, totalAmount: true, paidAmount: true, currency: true, dueDate: true },
  });

  const rows = debts
    .map((debt) => ({
      counterparty: debt.counterparty,
      remaining: Number(debt.totalAmount) - Number(debt.paidAmount),
      currency: debt.currency,
      dueDate: debt.dueDate as Date,
    }))
    .filter((debt) => debt.remaining > 0.009);

  if (!rows.length) {
    return NextResponse.json({ ok: true, debts: 0, sent: 0 });
  }

  const overdue = rows.filter((debt) => debt.dueDate < today);
  const soon = rows.filter((debt) => debt.dueDate >= today);

  const line = (debt: (typeof rows)[number]) => {
    const days = Math.round((debt.dueDate.getTime() - today.getTime()) / 864e5);
    const when = days < 0 ? `${Math.abs(days)} kun o'tdi` : days === 0 ? "bugun" : `${days} kun qoldi`;
    return `• ${debt.counterparty} — ${money(debt.remaining, debt.currency)} (${when})`;
  };

  const text = [
    "🧮 Qarz eslatmasi",
    overdue.length ? `\n🔴 Muddati o'tgan:\n${overdue.map(line).join("\n")}` : "",
    soon.length ? `\n🟡 Muddati yaqin:\n${soon.map(line).join("\n")}` : "",
    "\nBatafsil: dorixonaa.vercel.app/qarzlar",
  ]
    .filter(Boolean)
    .join("\n");

  const sent = await sendToAdmins(text);
  return NextResponse.json({ ok: true, debts: rows.length, overdue: overdue.length, sent });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
