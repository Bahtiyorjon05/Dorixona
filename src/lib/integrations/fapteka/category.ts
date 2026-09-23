/**
 * F-Apteka tovar nomidan dori turini (toifa) aniqlaydi.
 *
 * F-Apteka na SITE.exe push'ida, na hisobot API'sida tovar guruhini
 * yubormaydi — faqat nom keladi. Nomda esa dori shakli deyarli doim bor:
 * "PARATSETAMOL TAB №20", "AMOKSIKLAV SUSP 100ML", "DIKLOFENAK AMP 3ML".
 * Shuning uchun toifani nomdan aniqlaymiz. Ro'yxat yuqoridan pastga
 * tekshiriladi: birinchi mos kelgani olinadi.
 */

const RULES: { category: string; patterns: RegExp }[] = [
  { category: "Ampula va in'ektsiya", patterns: /\b(AMP|AMPULA|INEKS|INJEC|INYEKS|UKOL|FLAKON|FL\b|R-R|RASTVOR|INFUZ)/i },
  { category: "Tabletka", patterns: /\b(TAB|TABL|TABLETKA|PILL|DRAJE|LOZENG)/i },
  { category: "Kapsula", patterns: /\b(KAPS|CAPS|KAPSULA)/i },
  { category: "Sirop va suspenziya", patterns: /\b(SIROP|SYRUP|SUSP|EMULS|ELIKSIR|MIKSTURA)/i },
  { category: "Malham, krem, gel", patterns: /\b(MAZ|MALHAM|MALXAM|KREM|CREAM|GEL|LINIMENT|PASTA)/i },
  { category: "Tomchi", patterns: /\b(KAPLI|TOMCHI|DROPS|KAPL|GLAZ|KO'Z|KOZ)\b/i },
  { category: "Sprey va ingalyator", patterns: /\b(SPREY|SPRAY|AEROZOL|INGAL|NEBUL)/i },
  { category: "Svecha (suppozitoriy)", patterns: /\b(SVECH|SUPPOZ|SUPP)\b/i },
  { category: "Kukun va choy", patterns: /\b(POROSHOK|PORO[SŞ]|KUKUN|SASHE|SASHET|CHAY|CHAI|FITO|SBOR)/i },
  { category: "Vitamin va BAD", patterns: /\b(VITAMIN|BAD\b|OMEGA|MAGNE|KALTSIY|CALCIUM|ZINK|ASKORB)/i },
  { category: "Tibbiy buyum", patterns: /\b(SHPRITS|SHPRIC|BINT|VATA|PLASTIR|MASKA|PERCHAT|QO'LQOP|QOLQOP|GRELKA|TERMOMETR|TONOMETR|GLYUKOMETR|SISTEM|KATETER|ZOND|SALFET|BANDAJ|KORSET|BAHILA)/i },
  { category: "Kosmetika va gigiyena", patterns: /\b(SHAMPUN|SAPUN|SOAP|GIGIEN|PROKLAD|PAMPERS|PODGUZ|KOSMET|LOSON|SKRAB|DEZOD|ZUBN|PASTA ZUB)/i },
  { category: "Chaqaloq mahsulotlari", patterns: /\b(BABY|DETSK|CHAQALOQ|SMES|NUTRIL|NAN\b|MALYSH)/i },
];

export const FAPTEKA_DEFAULT_CATEGORY = "Boshqa dorilar";

/** Bu toifani kod qo'ygan (odam emas) — demak ustidan yozish mumkin */
export function isAutoCategory(category?: string | null) {
  if (!category) return true;
  if (category === "F-Apteka" || category === FAPTEKA_DEFAULT_CATEGORY) return true;
  return RULES.some((rule) => rule.category === category);
}

export function categoryFromName(name?: string | null) {
  const text = (name ?? "").trim();
  if (!text) return FAPTEKA_DEFAULT_CATEGORY;
  for (const rule of RULES) {
    if (rule.patterns.test(text)) return rule.category;
  }
  return FAPTEKA_DEFAULT_CATEGORY;
}
