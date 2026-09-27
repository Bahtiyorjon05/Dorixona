import { NextRequest } from "next/server";
import { digestMessage } from "@/lib/telegram/digest";
import { runDailyNotice } from "@/lib/telegram/daily-notice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Kunlik xulosa — kechqurun bir marta Telegram'ga yuboriladi.
 *
 * Ichida: bugungi savdo, naqd/karta, oy boshidan tushum, xarajat,
 * ochiq qarzlar va kam qoldiq. Ish kuni oxirida bir qarashda holatni
 * ko'rish uchun.
 *
 * Kim oladi: "moliya" ruxsati bo'lganlar.
 * Chaqiruvchi: dorixona kompyuteridagi relay (har 15 daqiqada) — endpoint
 * o'zi soatga qarab, kerakli paytda bir marta yuboradi.
 */
const SEND_AFTER_HOUR = 21;

async function handle(request: NextRequest) {
  return runDailyNotice(request, {
    source: "kunlik-xulosa",
    minHour: SEND_AFTER_HOUR,
    permission: "moliya",
    buttonText: "Panelni ochish",
    section: "overview",
    build: async () => ({ text: await digestMessage(), holat: {} }),
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
