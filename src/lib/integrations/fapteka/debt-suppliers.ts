/**
 * Qarzga tovar beradigan firmalar.
 *
 * Faqat shu firmalardan olingan tovar Qarzlar bo'limiga yoziladi. Qolgan
 * firmalardan tovar to'liq pulini to'lab olinadi — ular qarz emas.
 *
 * F-Apteka nomlarni kirilchada beradi ("ФАРМ ЛЮКС", "ООО «БИОТЕК»"), shuning
 * uchun nom lotinchaga o'giriladi va harf bo'lmagan hamma narsa olib
 * tashlanadi: "Фарм Люкс" → "farmlyuks". So'ng ro'yxatdagi kalit shu nom
 * ichida bormi — shu tekshiriladi.
 */
const DEBT_SUPPLIER_KEYS: Record<string, string[]> = {
  Biotek: ["biotek", "biotech"],
  Grand: ["grand"],
  Kuratsio: ["kuratsio", "kuracio", "curatio"],
  Meros: ["meros"],
  "Farm Luks": ["farmlyuks", "farmluks", "farmlux", "pharmlux", "pharmlyuks"],
  Yumaks: ["yumaks", "yumax", "iumaks"],
};

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
  э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

export function normalizeSupplierName(name: string) {
  return [...name.toLowerCase()]
    .map((char) => CYRILLIC[char] ?? char)
    .join("")
    .replace(/[^a-z]/g, "");
}

/** Firma qarzga tovar beradiganlar ro'yxatidami */
export function isDebtSupplier(name: string) {
  const normalized = normalizeSupplierName(name);
  if (!normalized) return false;
  return Object.values(DEBT_SUPPLIER_KEYS).some((keys) => keys.some((key) => normalized.includes(key)));
}
