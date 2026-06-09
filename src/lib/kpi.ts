// ─── KPI hisoblash mantig'i ───
// 100 ballik tizim. Tarkib og'irliklari:
//   Savdo 40% + Marja 20% + Davomat 15% + Intizom 10% + Mijoz 15%

export const KPI_WEIGHTS = {
  sales: 0.4,
  margin: 0.2,
  attendance: 0.15,
  discipline: 0.1,
  customer: 0.15,
} as const;

export type KpiComponents = {
  salesScore: number; // 0-100
  marginScore: number;
  attendanceScore: number;
  disciplineScore: number;
  customerScore: number;
};

/** Komponentlardan yakuniy 0-100 ballni hisoblaydi */
export function computeTotalScore(c: KpiComponents): number {
  const total =
    c.salesScore * KPI_WEIGHTS.sales +
    c.marginScore * KPI_WEIGHTS.margin +
    c.attendanceScore * KPI_WEIGHTS.attendance +
    c.disciplineScore * KPI_WEIGHTS.discipline +
    c.customerScore * KPI_WEIGHTS.customer;
  return Math.round(total);
}

/** Yakuniy balldan bonus foizini aniqlaydi */
export function bonusPercentForScore(score: number): number {
  if (score >= 90) return 20;
  if (score >= 80) return 10;
  if (score >= 70) return 5;
  if (score >= 60) return 0;
  return 0; // 60 dan past — bonus yo'q
}

/** Bonus miqdori (so'm) */
export function bonusAmount(baseSalary: number, score: number): number {
  return Math.round((baseSalary * bonusPercentForScore(score)) / 100);
}

/** Kechikish daqiqasidan davomat penalti ballini aniqlaydi */
export function latePenalty(minutes: number): number {
  if (minutes <= 5) return 0; // ogohlantirish
  if (minutes <= 15) return 2;
  if (minutes <= 60) return 5;
  return 10; // 60+ daqiqa + rahbariyat xabardor
}
