import { auth } from "@/auth";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Foydalanuvchi tizimga kirganini tekshiradi */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Avtorizatsiya talab qilinadi");
  return session.user;
}

/** Aktiv filialni qaytaradi */
export async function activeBranch() {
  const branch = await db.branch.findFirst({ where: { isActive: true } });
  if (!branch) throw new Error("Filial topilmadi");
  return branch;
}

export function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Xatolik yuz berdi" };
}
