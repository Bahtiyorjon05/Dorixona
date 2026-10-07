import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { carryRecurringExpenses } from "@/lib/recurring-expenses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Doimiy xarajatlarni shu oyga ko'chirish (src/lib/recurring-expenses.ts).
 *
 * Vercel Cron har kuni chaqiradi (vercel.json); ish oyiga bir marta,
 * 5-sanada bajariladi — undan oldin "waiting", keyin "already". Qo'lda:
 *   /api/expenses/recurring?token=<CRON_SECRET yoki FAPTEKA_SITE_TOKEN>
 */
function allowed(request: NextRequest) {
  if (request.headers.get("x-vercel-cron")) return true;

  const expected = process.env.CRON_SECRET?.trim() || process.env.FAPTEKA_SITE_TOKEN?.trim();
  if (!expected) return false;

  const auth = request.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return bearer === expected || request.nextUrl.searchParams.get("token")?.trim() === expected;
}

async function handle(request: NextRequest) {
  if (!allowed(request)) {
    return NextResponse.json({ ok: false, error: "Token noto'g'ri" }, { status: 401 });
  }
  try {
    // ?majburan=1 — oy belgilangan bo'lsa ham yetishmaganlarini qo'shadi (faqat token bilan)
    const force = request.nextUrl.searchParams.get("majburan") === "1" && !request.headers.get("x-vercel-cron");
    const result = await carryRecurringExpenses(new Date(), { force });
    if (result.status === "done" && result.created.length) {
      revalidatePath("/harajatlar");
      revalidatePath("/moliya");
      revalidatePath("/hisobotlar");
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Xatolik" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

/** Relay har 15 daqiqada turtadi (Vercel Cron ishlamay qolsa ham) */
export async function POST(request: NextRequest) {
  return handle(request);
}
