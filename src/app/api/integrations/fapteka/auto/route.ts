import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncFapteka } from "@/lib/integrations/fapteka/sync";
import { recomputeRange } from "@/lib/monthly-finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Avtomatik F-Apteka sync — sessiyasiz, token bilan.
 *
 * `/api/integrations/fapteka/sync` odam bosadigan tugma uchun (sessiya
 * talab qiladi), bu esa rejalashtiruvchilar uchun: Vercel Cron,
 * cron-job.org yoki dorixona kompyuteridagi vazifa.
 *
 * Chaqirish (GET ham, POST ham ishlaydi):
 *   /api/integrations/fapteka/auto?token=<CRON_SECRET>
 *   Authorization: Bearer <CRON_SECRET>     (Vercel Cron shu ko'rinishda yuboradi)
 *
 * Parametrlar:
 *   mode=sales|movements|catalog|all   (default: sales)
 *   days=2                             (default: 2 — bugun va kecha)
 *
 * Nega 2 kun: F-Apteka'da chek keyinroq tuzatilishi mumkin, shuning uchun
 * kechagi kunni ham qayta tortamiz. Sync `receiptNo` bo'yicha upsert
 * qilgani uchun takror yozuv paydo bo'lmaydi.
 */

const MODES = ["catalog", "movements", "sales", "all"] as const;
type Mode = (typeof MODES)[number];

function secretFromRequest(request: NextRequest) {
  const auth = request.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return (
    bearer ||
    request.headers.get("x-cron-secret")?.trim() ||
    request.nextUrl.searchParams.get("token")?.trim() ||
    ""
  );
}

/** YYYY-MM-DD, serverning UTC kuni bo'yicha */
function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function handle(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET .env da sozlanmagan" },
      { status: 503 },
    );
  }
  if (secretFromRequest(request) !== expected) {
    return NextResponse.json({ ok: false, error: "Token noto'g'ri" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const rawMode = params.get("mode") ?? "sales";
  const mode: Mode = (MODES as readonly string[]).includes(rawMode) ? (rawMode as Mode) : "sales";

  const days = Math.min(Math.max(Number(params.get("days") ?? 2) || 2, 1), 31);

  const dateFrom = isoDay(-(days - 1));
  const dateTo = isoDay(0);

  const startedAt = Date.now();
  try {
    const summary = await syncFapteka({ mode, dateFrom, dateTo });

    // Sync'dan keyin oylik moliyaviy xulosani ham yangilaymiz — aks holda
    // savdo tushsa ham /harajatlar dagi jadval eski raqamda qolardi.
    // Savdosi yo'q oy/dorixonaga tegilmaydi (qo'lda kiritilgani saqlanadi).
    let financeUpdated: string[] = [];
    const branch = await db.branch.findFirst({ where: { isActive: true } });
    if (branch) {
      const updated = await recomputeRange({
        branchId: branch.id,
        from: new Date(dateFrom),
        to: new Date(dateTo),
      });
      financeUpdated = updated.map((r) => `${r.unit} ${r.year}-${r.month}`);
    }

    console.info("F-Apteka AUTO sync", {
      mode,
      days,
      saleRows: summary.saleRows,
      salesUpserted: summary.salesUpserted,
      financeUpdated: financeUpdated.length,
      durationMs: Date.now() - startedAt,
      ok: summary.ok,
    });
    return NextResponse.json(
      { ok: summary.ok, summary, financeUpdated },
      { status: summary.ok ? 200 : 207 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync bajarilmadi";
    console.error("F-Apteka AUTO sync xato", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
