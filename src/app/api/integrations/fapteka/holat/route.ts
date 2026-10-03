import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminChatIds, sendTelegram } from "@/lib/telegram/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * F-Apteka'dan ma'lumot kelib turibdimi — "o'lik odam tugmasi".
 *
 *   /api/integrations/fapteka/holat               — faqat holat (JSON)
 *   /api/integrations/fapteka/holat?ogohlantir=1  — kechiksa adminlarga Telegram
 *
 * Ko'prik skript yoki SITE.exe to'xtab qolsa, o'zi xabar bera olmaydi —
 * shuning uchun tashqaridan (GitHub Actions, har 15 daqiqa) tekshiriladi.
 * Dorixona kompyuteridagi SITE nazoratchisi ham shu yerdan qaraydi.
 *
 * Login shart emas: faqat oxirgi kelgan vaqt ko'rsatiladi, ma'lumotning
 * o'zi emas. Bir muammo bo'yicha 3 soatda bir martadan ortiq yozilmaydi,
 * tiklanganda "tiklandi" deb xabar beriladi.
 */

/** Shuncha daqiqa hech narsa kelmasa — muammo */
const STALE_MINUTES = 40;
/** Bir muammo bo'yicha qayta eslatish oralig'i */
const REPEAT_HOURS = 3;
/** Kechasi bezovta qilinmaydi (Toshkent vaqti) */
const ALERT_FROM_HOUR = 8;
const ALERT_TO_HOUR = 23;
const STATE_SOURCE = "fapteka-holat";

type Kind = "relay" | "site";

const KINDS: Record<Kind, { source: string; down: (minutes: number, at: string) => string; up: string }> = {
  relay: {
    source: "fapteka-report",
    down: (minutes, at) =>
      `⚠️ <b>F-Apteka'dan savdo ma'lumoti kelmayapti</b>\n` +
      `${minutes} daqiqadan beri hech narsa yo'q (oxirgisi ${at}).\n\n` +
      `Dorixona kompyuterida tekshiring: kompyuter yoniqmi, internet bormi, ` +
      `«FApteka ERP» vazifasi ishlayaptimi (D:\\FAptekaRelay\\relay.log).`,
    up: "✅ F-Apteka savdo ma'lumoti yana kelmoqda.",
  },
  site: {
    source: "fapteka-site",
    down: (minutes, at) =>
      `⚠️ <b>SITE.exe qoldiq yubormayapti</b>\n` +
      `${minutes} daqiqadan beri hech narsa yo'q (oxirgisi ${at}).\n\n` +
      `Nazoratchi uni o'zi qayta ishga tushirishga urinadi. Bir soatda tiklanmasa, ` +
      `dorixona kompyuterida SITE.exe'ni qo'lda qayta oching.`,
    up: "✅ SITE.exe qoldiqni yana yubormoqda.",
  },
};

const TZ_MS = 5 * 3600_000;
const tashkentTime = (date: Date) => new Date(date.getTime() + TZ_MS).toISOString().slice(11, 16);
const tashkentHour = (date: Date) => new Date(date.getTime() + TZ_MS).getUTCHours();

async function lastArrival(source: string) {
  const row = await db.integrationLog.findFirst({
    where: { source },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

async function lastState(kind: Kind) {
  return db.integrationLog.findFirst({
    where: { source: STATE_SOURCE, note: { startsWith: `${kind}:` } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, note: true },
  });
}

export async function GET(request: NextRequest) {
  const notify = request.nextUrl.searchParams.get("ogohlantir") === "1";
  const now = new Date();
  const inHours = tashkentHour(now) >= ALERT_FROM_HOUR && tashkentHour(now) < ALERT_TO_HOUR;

  const result: Record<string, unknown> = { ok: true, vaqt: now.toISOString() };

  for (const kind of Object.keys(KINDS) as Kind[]) {
    const config = KINDS[kind];
    const last = await lastArrival(config.source);
    const minutes = last ? Math.floor((now.getTime() - last.getTime()) / 60_000) : null;
    const stale = minutes === null || minutes > STALE_MINUTES;
    const entry: Record<string, unknown> = {
      oxirgi: last?.toISOString() ?? null,
      daqiqa: minutes,
      holat: stale ? "kechikmoqda" : "joyida",
    };

    if (notify) {
      const state = await lastState(kind);
      const alerted = state?.note?.endsWith(":alert") ?? false;
      const alertedLongAgo = state ? now.getTime() - state.createdAt.getTime() > REPEAT_HOURS * 3600_000 : true;
      let text: string | null = null;
      let mark: string | null = null;

      if (stale && inHours && (!alerted || alertedLongAgo)) {
        text = config.down(minutes ?? 0, last ? tashkentTime(last) : "hech qachon");
        mark = `${kind}:alert`;
      } else if (!stale && alerted) {
        text = config.up;
        mark = `${kind}:ok`;
      }

      if (text && mark) {
        const outcomes = await sendTelegram(adminChatIds(), text);
        await db.integrationLog.create({
          data: {
            source: STATE_SOURCE,
            rowCount: outcomes.filter((o) => o.ok).length,
            note: `${mark} | ${minutes ?? "-"} daqiqa`,
            ok: true,
          },
        });
        entry.yuborildi = mark;
      }
    }

    result[kind] = entry;
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
