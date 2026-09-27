import { NextRequest } from "next/server";
import { stockAlert } from "@/lib/telegram/digest";
import { runDailyNotice } from "@/lib/telegram/daily-notice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ombor ogohlantirishi — ertalab bir marta.
 *
 * Tugab qolgan va muddati 30 kun ichida tugaydigan dorilar. Aytadigan
 * narsa bo'lmasa xabar yuborilmaydi.
 *
 * Kim oladi: "ombor" ruxsati bo'lganlar.
 */
const SEND_AFTER_HOUR = 9;

async function handle(request: NextRequest) {
  return runDailyNotice(request, {
    source: "ombor-ogohlantirish",
    minHour: SEND_AFTER_HOUR,
    permission: "ombor",
    buttonText: "Omborni ochish",
    section: "inventory",
    build: async () => {
      const alert = await stockAlert();
      return { text: alert.text, holat: { tugagan: alert.low, muddati: alert.expiring } };
    },
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
