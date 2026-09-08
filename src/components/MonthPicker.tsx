"use client";

import { useRouter } from "next/navigation";
import { monthName } from "@/lib/format";

/**
 * Yil + oy tanlagich. Har qanday yil va oyni tanlash mumkin — ro'yxat
 * ma'lumot bor oylar bilan cheklanmaydi. Ma'lumoti bor oy • bilan
 * belgilanadi, shunda qaysi oyda yozuv borligi ko'rinib turadi.
 *
 * Tanlov URL'ga `?oy=YYYY-M` bo'lib yoziladi, shuning uchun havolani
 * ulashsa ham o'sha oy ochiladi.
 */
export function MonthPicker({
  current,
  available,
  basePath,
}: {
  /** Joriy ko'rsatilayotgan oy, `YYYY-M` */
  current: string;
  /** Ma'lumot bor oylar, `YYYY-M` */
  available: string[];
  basePath: string;
}) {
  const router = useRouter();
  const [currentYear, currentMonth] = current.split("-").map(Number);
  const hasData = new Set(available);

  const go = (year: number, month: number) =>
    router.push(`${basePath}?oy=${year}-${month}`);

  const shift = (step: number) => {
    const d = new Date(currentYear, currentMonth - 1 + step, 1);
    go(d.getFullYear(), d.getMonth() + 1);
  };

  // Yillar: ma'lumot bor eng eski yildan keyingi yilgacha, joriy yil doim ichida
  const thisYear = new Date().getFullYear();
  const dataYears = available.map((key) => Number(key.split("-")[0]));
  const minYear = Math.min(thisYear - 2, currentYear, ...dataYears);
  const maxYear = Math.max(thisYear + 1, currentYear);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const selectClass = "rounded-lg border border-edge bg-transparent px-2 py-1.5 text-xs";
  const buttonClass = "rounded-lg border border-edge px-2.5 py-1.5 text-xs hover:bg-surface";

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => shift(-1)} aria-label="Oldingi oy" className={buttonClass}>
        ‹
      </button>

      <select
        value={currentMonth}
        onChange={(e) => go(currentYear, Number(e.target.value))}
        aria-label="Oy"
        className={selectClass}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {monthName(m)}
            {hasData.has(`${currentYear}-${m}`) ? " •" : ""}
          </option>
        ))}
      </select>

      <select
        value={currentYear}
        onChange={(e) => go(Number(e.target.value), currentMonth)}
        aria-label="Yil"
        className={selectClass}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <button onClick={() => shift(1)} aria-label="Keyingi oy" className={buttonClass}>
        ›
      </button>
    </div>
  );
}
