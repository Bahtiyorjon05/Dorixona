"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { FILIAL_COOKIE, isFilial } from "@/lib/filial";

/** Yuqoridagi tanlovdan filialni almashtirish. */
export async function setFilial(value: string) {
  if (!isFilial(value)) return;
  const store = await cookies();
  store.set(FILIAL_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  // Barcha bo'limlar tanlangan filialga moslashadi
  revalidatePath("/", "layout");
}
