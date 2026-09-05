/**
 * Dorixona filiallari. Bu fayl faqat konstanta va toza funksiyalar saqlaydi,
 * shuning uchun client komponentlarda ham import qilsa bo'ladi.
 * Cookie o'qish uchun: `@/lib/filial-server`.
 */
export const FILIALS = ["Umumiy", "Yunusobod", "Qoraqamish"] as const;
export type Filial = (typeof FILIALS)[number];

export const FILIAL_COOKIE = "filial";

export function isFilial(value: unknown): value is Filial {
  return typeof value === "string" && (FILIALS as readonly string[]).includes(value);
}

/**
 * Prisma `where` uchun filial filtri.
 * Umumiy tanlansa filtr qo'yilmaydi (hamma yozuv ko'rinadi).
 */
export function unitWhere(filial: Filial): { unit?: string } {
  return filial === "Umumiy" ? {} : { unit: filial };
}
