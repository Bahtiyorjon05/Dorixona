// O'zbekcha formatlash yordamchilari
//
// DIQQAT: sana va soat HAR DOIM Toshkent vaqtida ko'rsatiladi.
// Sayt Vercel'da UTC bo'yicha ishlaydi, shuning uchun server tomonda
// chizilgan sahifada d.getHours() 5 soat orqada chiqardi — "oxirgi
// tekshiruv" kabi joylarda soat noto'g'ri ko'rinardi. Sanada esa bundan
// ham yomoni: kechqurun yozilgan sana bir kun orqaga siljib ketardi.

/** Dorixona vaqti. Boshqa shaharga ko'chsa env orqali o'zgartiriladi. */
const TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE?.trim() || "Asia/Tashkent";

/** Sanani Toshkent vaqtidagi kun/oy/yilga ajratadi */
function partsIn(date: Date) {
  // en-CA "2026-09-27" ko'rinishida beradi — ajratish oson
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return { year, month, day };
}

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

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

/** Sana: "5 iyun, 2024" (Toshkent vaqti) */
export function formatDate(date: Date | string): string {
  const { year, month, day } = partsIn(toDate(date));
  return `${day} ${UZ_MONTHS[month - 1]}, ${year}`;
}

/** Vaqt: "08:52" (Toshkent vaqti) */
export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(toDate(date));
}

/** Sana va soat: "27 sentabr, 2026 14:20" */
export function formatDateTime(date: Date | string): string {
  const d = toDate(date);
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** Oy nomi: 6 -> "iyun" */
export function monthName(month: number): string {
  return UZ_MONTHS[(month - 1 + 12) % 12];
}

export function weekdayShort(date: Date): string {
  // Hafta kuni ham Toshkent sanasidan olinadi
  const { year, month, day } = partsIn(date);
  return UZ_WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/** Foiz: 8.2 -> "8.2%" */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}
