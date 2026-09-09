import { isFilial, type Filial } from "@/lib/filial";

/**
 * F-Apteka "O" (otdel / filial ID) → dorixona nomi.
 *
 * F-Apteka'da ro'yxat: Sklad → FAPTEKA → Spravochnaya → Filialy.
 * Push faylida har qatorda O=1, O=2 ... bo'lib keladi.
 *
 * Vercel env'da shunday sozlanadi:
 *   FAPTEKA_OTDEL_UNITS="2:Yunusobod,3:Shayxontohur"
 *
 * Sozlanmagan bo'lsa bo'sh Map qaytadi va otdelga bog'liq hisob
 * umuman ishlamaydi — noto'g'ri dorixonaga yozib qo'ymaslik uchun
 * taxmin qilinmaydi.
 */
export function otdelUnitMap(): Map<string, Filial> {
  const raw = process.env.FAPTEKA_OTDEL_UNITS?.trim();
  const map = new Map<string, Filial>();
  if (!raw) return map;

  for (const pair of raw.split(",")) {
    const [id, name] = pair.split(":").map((part) => part.trim());
    if (!id || !name) continue;
    if (!isFilial(name)) continue; // noma'lum nom jimgina tashlanadi
    map.set(id, name);
  }
  return map;
}
