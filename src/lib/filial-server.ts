import "server-only";
import { cookies } from "next/headers";
import { FILIAL_COOKIE, isFilial, type Filial } from "@/lib/filial";

/** Joriy tanlangan filial (cookie'dan). Default: Umumiy. */
export async function currentFilial(): Promise<Filial> {
  const store = await cookies();
  const value = store.get(FILIAL_COOKIE)?.value;
  return isFilial(value) ? value : "Umumiy";
}
