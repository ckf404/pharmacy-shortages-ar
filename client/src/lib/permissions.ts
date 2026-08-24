export const permissionLabels = {
  shortages_create: "إضافة النواقص",
  shortages_update: "تغيير حالة الصنف",
  shortages_delete: "حذف النواقص",
  orders_prepare: "تجهيز طلب واتساب",
  suppliers_manage: "إدارة المخازن",
  suppliers_delete: "حذف المخازن",
  users_manage: "إدارة المستخدمين",
  messages_manage: "إدارة الرسائل",
  settings_manage: "تعديل التنسيق والمحتوى",
  rollover_manage: "إدارة الترحيل",
  activity_view: "عرض سجل العمليات",
} as const;

export type PermissionKey = keyof typeof permissionLabels;
type Role = "user" | "supervisor" | "admin";

const userDefaults: PermissionKey[] = ["shortages_create", "shortages_update", "orders_prepare"];
const supervisorDefaults: PermissionKey[] = Object.keys(permissionLabels) as PermissionKey[];

export function parseUserPermissions(raw: string | null | undefined, role: Role): PermissionKey[] {
  if (role === "admin" || role === "supervisor") return Object.keys(permissionLabels) as PermissionKey[];
  if (!raw) return userDefaults;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((key): key is PermissionKey => typeof key === "string" && key in permissionLabels) : userDefaults;
  } catch {
    return userDefaults;
  }
}

export function hasPermission(user: { role: Role; permissions?: string | null } | null | undefined, permission: PermissionKey) {
  return !!user && (user.role === "admin" || parseUserPermissions(user.permissions, user.role).includes(permission));
}
