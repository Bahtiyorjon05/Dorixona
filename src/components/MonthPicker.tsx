"use client";

import { useRouter } from "next/navigation";
import { monthName } from "@/lib/format";

/**
 * Oy tanlagich. Tanlov URL'ga `?oy=YYYY-M` bo'lib yoziladi, shuning uchun
 * havolani ulashsa ham o'sha oy ochiladi.
 */
export function MonthPicker({
  current,
  available,
  basePath,
}: {
  /** Joriy ko'rsatilayotgan oy */
  current: string;
  /** Ma'lumot bor oylar (YYYY-M), yangisi birinchi */
  available: string[];
  basePath: string;
}) {
  const router = useRouter();

  // Joriy oy ro'yxatda bo'lmasa ham tanlangan bo'lib ko'rinsin
  const options = available.includes(current) ? available : [current, ...available];

  const label = (key: string) => {
    const [year, month] = key.split("-").map(Number);
    return `${monthName(month)} ${year}`;
  };

  const shift = (step: number) => {
    const [year, month] = current.split("-").map(Number);
    const d = new Date(year, month - 1 + step, 1);
    router.push(`${basePath}?oy=${d.getFullYear()}-${d.getMonth() + 1}`);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => shift(-1)}
        aria-label="Oldingi oy"
        className="rounded-lg border border-edge px-2.5 py-1.5 text-xs hover:bg-surface"
      >
        ‹
      </button>
      <select
        value={current}
        onChange={(e) => router.push(`${basePath}?oy=${e.target.value}`)}
        aria-label="Oy tanlash"
        className="rounded-lg border border-edge bg-transparent px-2 py-1.5 text-xs"
      >
        {options.map((key) => (
          <option key={key} value={key}>
            {label(key)}
          </option>
        ))}
      </select>
      <button
        onClick={() => shift(1)}
        aria-label="Keyingi oy"
        className="rounded-lg border border-edge px-2.5 py-1.5 text-xs hover:bg-surface"
      >
        ›
      </button>
    </div>
  );
}
