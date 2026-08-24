export const permissionKeys = [
  "shortages_create",
  "shortages_update",
  "shortages_delete",
  "orders_prepare",
  "suppliers_manage",
  "suppliers_delete",
  "users_manage",
  "messages_manage",
  "settings_manage",
  "rollover_manage",
  "activity_view",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];
export type PermissionMap = Record<PermissionKey, boolean>;

const allPermissions = (): PermissionMap => Object.fromEntries(permissionKeys.map(key => [key, true])) as PermissionMap;

const userDefaults: PermissionMap = {
  shortages_create: true,
  shortages_update: true,
  shortages_delete: false,
  orders_prepare: true,
  suppliers_manage: false,
  suppliers_delete: false,
  users_manage: false,
  messages_manage: false,
  settings_manage: false,
  rollover_manage: false,
  activity_view: false,
};

const supervisorDefaults: PermissionMap = allPermissions();

export function defaultPermissions(role: "user" | "supervisor" | "admin"): PermissionMap {
  if (role === "admin") return allPermissions();
  return { ...(role === "supervisor" ? supervisorDefaults : userDefaults) };
}

export function parsePermissions(raw: string | null | undefined, role: "user" | "supervisor" | "admin"): PermissionMap {
  const defaults = defaultPermissions(role);
  if (role === "admin" || role === "supervisor" || !raw) return defaults;
  try {
    const values = JSON.parse(raw) as unknown;
    if (!Array.isArray(values)) return defaults;
    const allowed = new Set(values.filter((value): value is PermissionKey => typeof value === "string" && (permissionKeys as readonly string[]).includes(value)));
    return Object.fromEntries(permissionKeys.map(key => [key, allowed.has(key)])) as PermissionMap;
  } catch {
    return defaults;
  }
}

export function serializePermissions(keys: PermissionKey[]) {
  return JSON.stringify(Array.from(new Set(keys.filter(key => (permissionKeys as readonly string[]).includes(key)))));
}

export function canUsePermission(user: { role: "user" | "supervisor" | "admin"; permissions?: string | null }, permission: PermissionKey) {
  return user.role === "admin" || parsePermissions(user.permissions, user.role)[permission];
}
