import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { readUserAccess } from "@/lib/permission-db";
import { ALL_PERMISSIONS, canAccessPermission, type AppPermission } from "@/lib/permissions";
import { verifyMiniSession } from "@/lib/mini-session";
import { verifyTelegramMiniApp } from "@/lib/telegram-auth";

export type RequestAccess =
  | {
      ok: true;
      source: "telegram-admin" | "employee";
      user: { id: string; name: string; role: string; permissions: string[]; editPermissions: string[] };
    }
  | { ok: false; error: string; status: number };

export async function verifyRequestAccess(req: NextRequest): Promise<RequestAccess> {
  const auth = req.headers.get("authorization") ?? "";

  if (auth.startsWith("tma ")) {
    const verified = verifyTelegramMiniApp(auth.slice(4));
    if (!verified.ok) return verified;
    return {
      ok: true,
      source: "telegram-admin",
      user: {
        id: String(verified.user.id),
        name: verified.user.first_name ?? verified.user.username ?? "Admin",
        role: "OWNER",
        permissions: [...ALL_PERMISSIONS],
        editPermissions: [...ALL_PERMISSIONS],
      },
    };
  }

  if (auth.startsWith("mini ")) {
    const payload = verifyMiniSession(auth.slice(5));
    if (!payload) return { ok: false, error: "Mini App login muddati tugagan", status: 401 };
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return { ok: false, error: "Login faol emas", status: 403 };
    const access = await readUserAccess(user.id, user.role);
    return {
      ok: true,
      source: "employee",
      user: {
        id: user.id,
        name: user.fullName,
        role: user.role,
        permissions: access.permissions,
        editPermissions: access.editPermissions,
      },
    };
  }

  return { ok: false, error: "Avtorizatsiya topilmadi", status: 401 };
}

export function canRead(access: RequestAccess & { ok: true }, permission: AppPermission) {
  return canAccessPermission(access.user.role, access.user.permissions, permission);
}

export function canEdit(access: RequestAccess & { ok: true }, permission: AppPermission) {
  return access.user.role === "OWNER" || access.user.editPermissions.includes(permission);
}
