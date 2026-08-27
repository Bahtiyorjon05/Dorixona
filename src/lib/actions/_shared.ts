import { auth } from "@/auth";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

type BranchLike = { id: string; name: string; isActive?: boolean | null };

type ResolveBranchInput = {
  sessionBranchId: string | null | undefined;
  activeBranch: BranchLike | null;
  firstBranch: BranchLike | null;
};

export function resolveBranchFallback({
  sessionBranchId,
  activeBranch,
  firstBranch,
}: ResolveBranchInput): BranchLike | null {
  if (sessionBranchId && activeBranch && activeBranch.id === sessionBranchId) return activeBranch;
  if (sessionBranchId && firstBranch && firstBranch.id === sessionBranchId) return firstBranch;
  if (activeBranch) return activeBranch;
  if (firstBranch) return firstBranch;
  return null;
}

/** Foydalanuvchi tizimga kirganini tekshiradi */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Avtorizatsiya talab qilinadi");
  return session.user;
}

/** Aktiv filialni qaytaradi */
export async function activeBranch(): Promise<NonNullable<Awaited<ReturnType<typeof db.branch.findFirst>>>> {
  const session = await auth();
  const sessionBranchId = session?.user?.branchId ?? null;

  const [active, first] = await Promise.all([
    db.branch.findFirst({ where: { isActive: true } }),
    db.branch.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  if (sessionBranchId) {
    if (active?.id === sessionBranchId) return active;
    if (first?.id === sessionBranchId) return first;
    const sessionBranch = await db.branch.findUnique({ where: { id: sessionBranchId } });
    if (sessionBranch) return sessionBranch;
  }

  const branch = resolveBranchFallback({ sessionBranchId, activeBranch: active, firstBranch: first });
  if (branch) return branch as NonNullable<Awaited<ReturnType<typeof db.branch.findFirst>>>;

  const created = await db.branch.create({
    data: {
      name: "Asosiy filial",
      address: "Asosiy filial",
      isActive: true,
    },
  });
  return created;
}

export function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Xatolik yuz berdi" };
}
