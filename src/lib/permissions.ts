export const PERMISSION_DEFS = [
  { key: "moliya", label: "Moliya", path: "/moliya" },
  { key: "harajatlar", label: "Harajatlar", path: "/harajatlar" },
  { key: "ombor", label: "Ombor", path: "/ombor" },
  { key: "pos", label: "Kassa (POS)", path: "/pos" },
  { key: "mijozlar", label: "Mijozlar", path: "/mijozlar" },
  { key: "xodimlar", label: "Xodimlar", path: "/xodimlar" },
  { key: "kpi", label: "KPI", path: "/kpi" },
  { key: "davomat", label: "Davomat", path: "/davomat" },
  { key: "hisobotlar", label: "Hisobotlar", path: "/hisobotlar" },
  { key: "sozlamalar", label: "Sozlamalar", path: "/sozlamalar" },
] as const;

export type AppPermission = (typeof PERMISSION_DEFS)[number]["key"];

export const ALL_PERMISSIONS = PERMISSION_DEFS.map((permission) => permission.key);

export function isAppPermission(value: string): value is AppPermission {
  return ALL_PERMISSIONS.includes(value as AppPermission);
}

export function normalizePermissions(values: unknown): AppPermission[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is AppPermission => typeof value === "string" && isAppPermission(value));
}

export function defaultPermissionsForRole(role?: string | null): AppPermission[] {
  if (role === "OWNER") return [...ALL_PERMISSIONS];
  if (role === "MANAGER") return ALL_PERMISSIONS.filter((permission) => permission !== "sozlamalar");
  if (role === "PHARMACIST") return ["ombor", "pos", "mijozlar"];
  if (role === "CASHIER") return ["pos", "mijozlar"];
  return [];
}

export function permissionsForUser(role?: string | null, permissions?: string[] | null) {
  if (role === "OWNER") return [...ALL_PERMISSIONS];
  if (!permissions) return defaultPermissionsForRole(role);
  return normalizePermissions(permissions);
}

export function canAccessPermission(role: string | undefined | null, permissions: string[] | undefined | null, permission: AppPermission) {
  return permissionsForUser(role, permissions).includes(permission);
}

export function permissionForPath(pathname: string): AppPermission | null {
  const found = PERMISSION_DEFS.find((permission) => pathname === permission.path || pathname.startsWith(`${permission.path}/`));
  return found?.key ?? null;
}

export function firstAllowedPath(role?: string | null, permissions?: string[] | null) {
  const allowed = permissionsForUser(role, permissions);
  return PERMISSION_DEFS.find((permission) => allowed.includes(permission.key))?.path ?? "/login";
}
