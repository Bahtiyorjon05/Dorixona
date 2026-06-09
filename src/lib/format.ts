// O'zbekcha formatlash yordamchilari

const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

const UZ_WEEKDAYS = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Sha"];

/** Sonni bo'sh joy bilan ajratib formatlaydi: 4250000 -> "4 250 000" */
export function formatNumber(value: number | string | bigint): string {
  const n = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(n)) return "0";
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Pul summasi: "4 250 000 so'm" */
export function formatSom(value: number | string | bigint): string {
  return `${formatNumber(value)} so'm`;
}

/** Qisqa pul: 18_700_000 -> "18.7M" */
export function formatCompact(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Sana: "5 iyun, 2024" */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getDate()} ${UZ_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

/** Vaqt: "08:52" */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Oy nomi: 6 -> "iyun" */
export function monthName(month: number): string {
  return UZ_MONTHS[(month - 1 + 12) % 12];
}

export function weekdayShort(date: Date): string {
  return UZ_WEEKDAYS[date.getDay()];
}

/** Foiz: 8.2 -> "8.2%" */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}
