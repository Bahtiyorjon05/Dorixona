import { isFilial, type Filial } from "@/lib/filial";

/**
 * F-Apteka "O" (otdel / filial ID) → dorixona nomi.
 *
 * F-Apteka'da ro'yxat: Sklad → FAPTEKA → Spravochnaya → Filialy.
 * Push faylida har qatorda O=2, O=3 ... bo'lib keladi.
 *
 * ID lar F-Apteka Filialy ro'yxatidan va push ma'lumotidan aniqlangan:
 *   2 → ЮНУСОБОД, 3 → ШАЙХАНТОХУР
 * Shuning uchun default kodda turadi — hech kim env sozlashi shart emas.
 * Kelajakda o'zgarsa (yangi filial, boshqa ID) Vercel env orqali
 * ustidan yoziladi:
 *   FAPTEKA_OTDEL_UNITS="2:Yunusobod,3:Shayxontohur"
 * Bu — sir emas, oddiy moslik jadvali, shuning uchun kodda saqlashda
 * xavf yo'q.
 */
const DEFAULT_OTDEL_UNITS: Record<string, Filial> = {
  "2": "Yunusobod",
  "3": "Shayxontohur",
};

export function otdelUnitMap(): Map<string, Filial> {
  const map = new Map<string, Filial>();

  const raw = process.env.FAPTEKA_OTDEL_UNITS?.trim();
  if (!raw) {
    // Env yo'q — koddagi default ishlatiladi
    for (const [id, name] of Object.entries(DEFAULT_OTDEL_UNITS)) map.set(id, name);
    return map;
  }

  // Env bor — u to'liq ustunlik qiladi (defaultni almashtiradi)
  for (const pair of raw.split(",")) {
    const [id, name] = pair.split(":").map((part) => part.trim());
    if (!id || !name) continue;
    if (!isFilial(name)) continue; // noma'lum nom jimgina tashlanadi
    map.set(id, name);
  }
  return map;
}
