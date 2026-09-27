/**
 * Telefon raqamlarini solishtirish.
 *
 * Bir xil raqam har xil yozilgan bo'lishi mumkin:
 *   +998 90 123 45 67 · 998901234567 · 901234567 · (90) 123-45-67
 * Shuning uchun faqat raqamlar qoldiriladi va OXIRGI 9 TA olinadi —
 * O'zbekistonda milliy raqam shuncha (operator kodi + 7 raqam).
 * Shunda "+998" bor-yo'qligi va bo'shliqlar ahamiyatsiz bo'ladi.
 */
export const PHONE_KEY_LENGTH = 9;

/** Solishtirish uchun kalit; raqam yetarli bo'lmasa null */
export function phoneKey(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < PHONE_KEY_LENGTH) return null;
  return digits.slice(-PHONE_KEY_LENGTH);
}

/** Ikki raqam bir xil odamnikimi */
export function samePhone(a: string | null | undefined, b: string | null | undefined) {
  const left = phoneKey(a);
  return left !== null && left === phoneKey(b);
}

/** Saqlash uchun ko'rinish: +998901234567 */
export function formatPhone(value: string | null | undefined): string | null {
  const key = phoneKey(value);
  if (!key) return null;
  const digits = (value ?? "").replace(/\D/g, "");
  // 12 xonali (998...) bo'lsa o'zini, aks holda 998 qo'shamiz
  const full = digits.length >= 12 ? digits.slice(-12) : `998${key}`;
  return `+${full}`;
}
