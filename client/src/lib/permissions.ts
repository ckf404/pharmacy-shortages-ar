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
const supervisorDefaults: PermissionKey[] = ["shortages_create", "shortages_update", "shortages_delete", "orders_prepare", "suppliers_manage", "suppliers_delete", "messages_manage", "rollover_manage", "activity_view"];

export function parseUserPermissions(raw: string | null | undefined, role: Role): PermissionKey[] {
  if (role === "admin") return Object.keys(permissionLabels) as PermissionKey[];
  if (!raw) return role === "supervisor" ? supervisorDefaults : userDefaults;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((key): key is PermissionKey => typeof key === "string" && key in permissionLabels) : (role === "supervisor" ? supervisorDefaults : userDefaults);
  } catch {
    return role === "supervisor" ? supervisorDefaults : userDefaults;
  }
}

export function hasPermission(user: { role: Role; permissions?: string | null } | null | undefined, permission: PermissionKey) {
  return !!user && (user.role === "admin" || parseUserPermissions(user.permissions, user.role).includes(permission));
}
