/**
 * F-Apteka tovar nomidan dori turini (toifa) aniqlaydi.
 *
 * F-Apteka na SITE.exe push'ida, na hisobot API'sida tovar guruhini
 * yubormaydi — faqat nom keladi. Nomda esa dori shakli deyarli doim bor:
 * "ПАРАЦЕТАМОЛ ТАБ №20", "АМОКСИКЛАВ СУСП 100МЛ", "ДИКЛОФЕНАК АМП 3МЛ".
 * Nomlar kirilchada keladi, shuning uchun har bir qoidada kirilcha ham,
 * lotincha ham bor. Ro'yxat yuqoridan pastga tekshiriladi: birinchi mos
 * kelgani olinadi.
 */

const RULES: { category: string; patterns: RegExp }[] = [
  {
    category: "Ampula va in'ektsiya",
    patterns:
      /(АМП|АМПУЛ|ИНЪЕК|ИНЕКЦ|УКОЛ|ФЛАК|Р-Р|РАСТВОР|ИНФУЗ|ЛИОФ|AMP|AMPULA|INEKS|INJEC|INYEKS|UKOL|FLAKON|RASTVOR|INFUZ)/i,
  },
  { category: "Tabletka", patterns: /(ТАБ|ТБЛ|ДРАЖЕ|ПИЛЮЛ|TAB|TABL|TABLETKA|DRAJE|PILL)/i },
  { category: "Kapsula", patterns: /(КАПС|КПС|KAPS|CAPS|KAPSULA)/i },
  {
    category: "Sirop va suspenziya",
    patterns: /(СИРОП|СУСП|ЭМУЛЬС|ЭЛИКСИР|МИКСТУР|НАСТОЙ|SIROP|SYRUP|SUSP|EMULS|ELIKSIR|MIKSTURA)/i,
  },
  { category: "Malham, krem, gel", patterns: /(МАЗЬ|МАЗИ|КРЕМ|ГЕЛЬ|ЛИНИМЕНТ|ПАСТА|БАЛЬЗАМ|MAZ|KREM|CREAM|GEL|LINIMENT)/i },
  { category: "Tomchi", patterns: /(КАПЛ|ГЛАЗН|УШН|НАЗАЛ|KAPLI|TOMCHI|DROPS)/i },
  { category: "Sprey va ingalyator", patterns: /(СПРЕЙ|АЭРОЗОЛ|ИНГАЛ|НЕБУЛ|SPREY|SPRAY|AEROZOL|INGAL|NEBUL)/i },
  { category: "Svecha (suppozitoriy)", patterns: /(СВЕЧ|СУППОЗ|SVECH|SUPPOZ)/i },
  {
    category: "Kukun va choy",
    patterns: /(ПОРОШ|ПОР\.|САШЕ|ЧАЙ|СБОР|ГРАНУЛ|POROSHOK|KUKUN|SASHE|CHAY|FITO|SBOR|GRANUL)/i,
  },
  {
    category: "Vitamin va BAD",
    patterns: /(ВИТАМИН|БАД|ОМЕГА|МАГНЕ|КАЛЬЦ|ЦИНК|АСКОРБ|VITAMIN|OMEGA|MAGNE|KALTSIY|CALCIUM|ZINK|ASKORB)/i,
  },
  {
    category: "Tibbiy buyum",
    patterns:
      /(ШПРИЦ|БИНТ|ВАТА|ПЛАСТЫР|МАСКА|ПЕРЧАТ|ГРЕЛКА|ТЕРМОМЕТР|ТОНОМЕТР|ГЛЮКОМЕТР|СИСТЕМА|КАТЕТЕР|ЗОНД|САЛФЕТ|БАНДАЖ|КОРСЕТ|БАХИЛ|ЖГУТ|ТЕСТ-ПОЛОС|SHPRITS|BINT|VATA|PLASTIR|MASKA|BANDAJ|KORSET)/i,
  },
  {
    category: "Kosmetika va gigiyena",
    patterns:
      /(ШАМПУН|МЫЛО|ГИГИЕН|ПРОКЛАД|ПАМПЕРС|ПОДГУЗ|КОСМЕТ|ЛОСЬОН|СКРАБ|ДЕЗОД|ЗУБН|SHAMPUN|SAPUN|GIGIEN|PROKLAD|PAMPERS|KOSMET)/i,
  },
  {
    category: "Chaqaloq mahsulotlari",
    patterns: /(ДЕТСК|МАЛЫШ|СМЕСЬ|НУТРИЛ|BABY|DETSK|CHAQALOQ|SMES|NUTRIL)/i,
  },
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
