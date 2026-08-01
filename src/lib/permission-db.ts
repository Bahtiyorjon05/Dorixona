import { db } from "@/lib/db";
import { ALL_PERMISSIONS, defaultPermissionsForRole, isAppPermission, type AppPermission } from "@/lib/permissions";

type PermissionRow = { permission: string; canEdit: boolean };

export async function ensurePermissionTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "UserPermission" (
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "permission" TEXT NOT NULL,
      "canEdit" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("userId", "permission")
    )
  `;
}

export async function readUserAccess(userId: string, role?: string | null) {
  if (role === "OWNER") {
    return { permissions: [...ALL_PERMISSIONS], editPermissions: [...ALL_PERMISSIONS] };
  }

  try {
    await ensurePermissionTable();
    const rows = await db.$queryRaw<PermissionRow[]>`
      SELECT "permission", "canEdit" FROM "UserPermission" WHERE "userId" = ${userId}
    `;
    const permissions = rows.map((row) => row.permission).filter(isAppPermission);
    const editPermissions = rows.filter((row) => row.canEdit).map((row) => row.permission).filter(isAppPermission);
    if (rows.length > 0) return { permissions, editPermissions };
  } catch (error) {
    console.error("Permission jadvali o'qilmadi:", error);
  }

  const fallback = defaultPermissionsForRole(role);
  return { permissions: fallback, editPermissions: fallback };
}

export async function saveUserAccess(userId: string, permissions: AppPermission[], editPermissions: AppPermission[]) {
  await ensurePermissionTable();
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "UserPermission" WHERE "userId" = ${userId}`;
    if (permissions.length === 0) {
      await tx.$executeRaw`
        INSERT INTO "UserPermission" ("userId", "permission", "canEdit")
        VALUES (${userId}, '__configured__', false)
      `;
    }
    for (const permission of permissions) {
      await tx.$executeRaw`
        INSERT INTO "UserPermission" ("userId", "permission", "canEdit")
        VALUES (${userId}, ${permission}, ${editPermissions.includes(permission)})
      `;
    }
  });
}
