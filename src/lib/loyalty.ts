import { LoyaltyTier } from "@/generated/prisma/client";

// ─── Sodiqlik (loyalty) tizimi qoidalari ───
// Markaziy joy: ham POS, ham Telegram bot shu yerdan foydalanadi.

/** Har necha so'mga 1 ball beriladi */
export const POINTS_PER_SOM = 10_000;

/** Ro'yxatdan o'tish bonusi (ball) */
export const SIGNUP_BONUS_POINTS = 50;

/** 1 ball = necha so'm chegirma (ballarni ishlatishda) */
export const POINT_VALUE_SOM = 100;

/** Daraja chegaralari (jami xarid, so'm) va doimiy chegirma foizi */
export const TIERS: Record<
  LoyaltyTier,
  { label: string; minSpent: number; discountPercent: number; emoji: string }
> = {
  BRONZE: { label: "Bronza", minSpent: 0, discountPercent: 0, emoji: "🥉" },
  SILVER: { label: "Kumush", minSpent: 500_000, discountPercent: 3, emoji: "🥈" },
  GOLD: { label: "Oltin", minSpent: 2_000_000, discountPercent: 5, emoji: "🥇" },
};

/** Jami xarid summasiga qarab darajani aniqlaydi */
export function tierForSpent(totalSpent: number): LoyaltyTier {
  if (totalSpent >= TIERS.GOLD.minSpent) return "GOLD";
  if (totalSpent >= TIERS.SILVER.minSpent) return "SILVER";
  return "BRONZE";
}

/** Xarid summasidan to'planadigan ballarni hisoblaydi */
export function pointsForPurchase(amount: number): number {
  return Math.floor(amount / POINTS_PER_SOM);
}

/** Daraja chegirma foizi */
export function tierDiscount(tier: LoyaltyTier): number {
  return TIERS[tier].discountPercent;
}

/** Keyingi darajagacha qancha xarid qolganini qaytaradi (yoki null — eng yuqori) */
export function spentToNextTier(
  totalSpent: number,
): { nextTier: LoyaltyTier; remaining: number } | null {
  if (totalSpent < TIERS.SILVER.minSpent)
    return { nextTier: "SILVER", remaining: TIERS.SILVER.minSpent - totalSpent };
  if (totalSpent < TIERS.GOLD.minSpent)
    return { nextTier: "GOLD", remaining: TIERS.GOLD.minSpent - totalSpent };
  return null;
}

/** Bonus karta kodi: FP-00123 */
export function makeCardCode(seq: number): string {
  return `FP-${String(seq).padStart(5, "0")}`;
}
