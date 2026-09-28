import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Avtomatik pereotsenkani F-Apteka bilan solishtirish uchun.
 *
 *   /api/integrations/fapteka/pereotsenka?token=<FAPTEKA_SITE_TOKEN>&oy=2026-10
 *   ...&kun=2026-10-05  — shu kunning dorilar ro'yxati
 *
 * Kunlik summani F-Apteka'dagi "Переоценка" oynasidagi o'sha kunning
 * hujjatlari bilan solishtiring ("Сумма 1" ustuni).
 */

function allowed(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim() || process.env.FAPTEKA_SITE_TOKEN?.trim();
  if (!expected) return false;
  return request.nextUrl.searchParams.get("token")?.trim() === expected;
}

const TZ_MS = 5 * 3600_000;

export async function GET(request: NextRequest) {
  if (!allowed(request)) {
    return NextResponse.json({ ok: false, error: "Token noto'g'ri" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const now = new Date(Date.now() + TZ_MS);
  const monthMatch = /^(\d{4})-(\d{1,2})$/.exec(params.get("oy") ?? "");
  const year = monthMatch ? Number(monthMatch[1]) : now.getUTCFullYear();
  const month = monthMatch ? Number(monthMatch[2]) : now.getUTCMonth() + 1;
  const start = new Date(Date.UTC(year, month - 1, 1) - TZ_MS);
  const end = new Date(Date.UTC(year, month, 1) - TZ_MS);

  const events = await db.revaluation.findMany({
    where: { at: { gte: start, lt: end } },
    orderBy: { at: "asc" },
  });
  const day = (date: Date) => new Date(date.getTime() + TZ_MS).toISOString().slice(0, 10);

  const byDay = new Map<string, number>();
  const byUnit = new Map<string, number>();
  for (const event of events) {
    const key = `${day(event.at)} ${event.unit}`;
    byDay.set(key, (byDay.get(key) ?? 0) + Number(event.amount));
    byUnit.set(event.unit, (byUnit.get(event.unit) ?? 0) + Number(event.amount));
  }

  const wantedDay = params.get("kun")?.trim();
  // charset ko'rsatilmasa Windows PowerShell 5.1 kirillni buzib o'qiydi
  return NextResponse.json({
    ok: true,
    oy: `${year}-${String(month).padStart(2, "0")}`,
    jami: Object.fromEntries([...byUnit].map(([unit, sum]) => [unit, Math.round(sum)])),
    kunlar: [...byDay].map(([key, sum]) => `${key}: ${Math.round(sum)}`),
    ...(wantedDay
      ? {
          dorilar: events
            .filter((event) => day(event.at) === wantedDay)
            .map((event) => ({
              vaqt: new Date(event.at.getTime() + TZ_MS).toISOString().slice(11, 16),
              dorixona: event.unit,
              dori: event.name,
              miqdor: Number(event.qty),
              eski: Number(event.oldPrice),
              yangi: Number(event.newPrice),
              summa: Number(event.amount),
            })),
        }
      : {}),
  }, { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
