import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  appMessageReads,
  appMessages,
  appSettings,
  shortageActivityLogs,
  shortageDays,
  shortageItems,
  shortageRolloverSettings,
  shortageSupplierOrderItems,
  shortageSupplierOrders,
  shortageSuppliers,
  users,
} from "../drizzle/schema";
import { cairoDayKey, decideArchivedTransfer, previousDayKey, selectRolloverCandidates } from "./shortagesDomain";
import { achievementLevel } from "./profile";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: Partial<InsertUser> & { openId: string }): Promise<void> {
  const safeOpenId = user.openId;
  if (!safeOpenId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    await db.insert(users).values({
      openId: safeOpenId,
      name: user.name ?? safeOpenId,
      username: user.username ?? `oauth-${safeOpenId}`,
      passwordHash: user.passwordHash ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? "user",
      active: user.active ?? true,
      lastSignedIn: user.lastSignedIn ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        name: user.name ?? safeOpenId,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        lastSignedIn: user.lastSignedIn ?? new Date(),
      },
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getLocalUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}

export async function getLocalUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.username, username)).limit(1))[0];
}

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const user = await getLocalUserById(userId);
  if (!user || user.deletedAt || !user.active) throw new Error("المستخدم غير موجود أو غير متاح");
  const [added, received, orders] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(shortageItems).where(eq(shortageItems.createdByUserId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(shortageItems).where(and(eq(shortageItems.receivedByUserId, userId), eq(shortageItems.status, "received"))),
    db.select({ count: sql<number>`count(*)` }).from(shortageSupplierOrders).where(eq(shortageSupplierOrders.createdByUserId, userId)),
  ]);
  return {
    user: { id: user.id, name: user.name, username: user.username, role: user.role, createdAt: user.createdAt },
    stats: achievementLevel(Number(added[0]?.count ?? 0), Number(received[0]?.count ?? 0), Number(orders[0]?.count ?? 0)),
  };
}

export async function listAchievementBoard() {
  const db = await getDb();
  if (!db) return [];
  const activeUsers = await db.select({ id: users.id, name: users.name, role: users.role })
    .from(users).where(and(eq(users.active, true), isNull(users.deletedAt))).orderBy(users.name);
  const entries = await Promise.all(activeUsers.map(async user => ({ ...user, ...(await getUserProfile(user.id)).stats })));
  return entries.sort((a, b) => b.points - a.points || b.orders - a.orders || b.received - a.received).slice(0, 12);
}

export async function updateOwnProfile(input: { userId: number; name: string; username: string; passwordHash?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const existingUsername = await getLocalUserByUsername(input.username);
  if (existingUsername && existingUsername.id !== input.userId) throw new Error("اسم المستخدم مستخدم بالفعل");
  await db.update(users).set({ name: input.name, username: input.username, ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}) }).where(eq(users.id, input.userId));
  await createAudit("profile_updated", "user", input.userId, input.userId, input.name);
  return getUserProfile(input.userId);
}

export async function listLoginAccounts(mode: "user" | "manager") {
  const db = await getDb();
  if (!db) return [];
  const roles = mode === "user" ? ["user"] as const : ["supervisor", "admin"] as const;
  return db.select({ id: users.id, name: users.name, username: users.username, role: users.role })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, [...roles])))
    .orderBy(users.name);
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    username: users.username,
    role: users.role,
    active: users.active,
    permissions: users.permissions,
    deletedAt: users.deletedAt,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(users.name);
}

export async function createAudit(action: string, entityType: string, entityId: number | null, actorUserId: number | null, details?: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.insert(shortageActivityLogs).values({ action, entityType, entityId, actorUserId, details: details ?? null });
}

export async function ensureRolloverSettings() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.insert(shortageRolloverSettings).values({ id: 1 }).onDuplicateKeyUpdate({ set: { id: sql`id` } });
  return (await db.select().from(shortageRolloverSettings).where(eq(shortageRolloverSettings.id, 1)).limit(1))[0]!;
}

export async function getRolloverSettingsByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return (await db.select().from(shortageRolloverSettings)
    .where(eq(shortageRolloverSettings.scheduleCronTaskUid, taskUid)).limit(1))[0];
}

export async function getOrCreateShortageDay(dayKey = cairoDayKey()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.insert(shortageDays).values({ dayKey }).onDuplicateKeyUpdate({ set: { dayKey: sql`dayKey` } });
  return (await db.select().from(shortageDays).where(eq(shortageDays.dayKey, dayKey)).limit(1))[0]!;
}

export async function getTodayDashboard(dayKey = cairoDayKey()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  // A dashboard visit is a safe, idempotent catch-up path if the midnight Heartbeat was delayed or missed.
  await rolloverOpenShortages(dayKey);
  const day = await getOrCreateShortageDay(dayKey);
  return { day, items: await listInvoiceItems(day.id) };
}

async function listInvoiceItems(shortageDayId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db.select({
    id: shortageItems.id,
    productName: shortageItems.productName,
    dosageForm: shortageItems.dosageForm,
    quantity: shortageItems.quantity,
    priority: shortageItems.priority,
    status: shortageItems.status,
    notes: shortageItems.notes,
    suggestedSupplierId: shortageItems.suggestedSupplierId,
    suggestedSupplierName: shortageSuppliers.name,
    receivedAt: shortageItems.receivedAt,
    createdAt: shortageItems.createdAt,
  }).from(shortageItems)
    .leftJoin(shortageSuppliers, eq(shortageItems.suggestedSupplierId, shortageSuppliers.id))
    .where(and(eq(shortageItems.shortageDayId, shortageDayId), inArray(shortageItems.status, ["open", "received"])))
    .orderBy(desc(shortageItems.createdAt));
}

export async function getShortageDayInvoice(dayKey: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const day = (await db.select().from(shortageDays).where(eq(shortageDays.dayKey, dayKey)).limit(1))[0];
  if (!day) throw new Error("فاتورة هذا اليوم غير موجودة");
  return { day, items: await listInvoiceItems(day.id) };
}

export async function listShortageDayArchive(limit = 31) {
  const db = await getDb();
  if (!db) return [];
  const days = await db.select({ id: shortageDays.id, dayKey: shortageDays.dayKey, createdAt: shortageDays.createdAt })
    .from(shortageDays).orderBy(desc(shortageDays.dayKey)).limit(limit);
  if (days.length === 0) return [];
  const summaries = await db.select({
    shortageDayId: shortageItems.shortageDayId,
    itemCount: sql<number>`count(*)`,
    openCount: sql<number>`sum(case when ${shortageItems.status} = 'open' then 1 else 0 end)`,
    receivedCount: sql<number>`sum(case when ${shortageItems.status} = 'received' then 1 else 0 end)`,
  }).from(shortageItems).where(inArray(shortageItems.shortageDayId, days.map(day => day.id))).groupBy(shortageItems.shortageDayId);
  const summaryByDay = new Map(summaries.map(summary => [summary.shortageDayId, summary]));
  return days.map(day => {
    const summary = summaryByDay.get(day.id);
    return {
      ...day,
      itemCount: Number(summary?.itemCount ?? 0),
      openCount: Number(summary?.openCount ?? 0),
      receivedCount: Number(summary?.receivedCount ?? 0),
    };
  });
}

export async function createShortageItem(input: {
  productName: string;
  dosageForm: "أقراص" | "شراب" | "مرهم" | "نقط" | "كريم" | "حقن";
  quantity: number;
  priority: "normal" | "important" | "urgent";
  notes?: string | null;
  suggestedSupplierId?: number | null;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const day = await getOrCreateShortageDay();
  const result = await db.insert(shortageItems).values({ ...input, shortageDayId: day.id, notes: input.notes ?? null, suggestedSupplierId: input.suggestedSupplierId ?? null });
  const id = Number(result[0].insertId);
  await createAudit("shortage_created", "shortage_item", id, input.createdByUserId, input.productName);
  return id;
}

export async function manuallyAddArchivedShortage(sourceItemId: number, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const targetDay = await getOrCreateShortageDay();
  const source = (await db.select().from(shortageItems).where(eq(shortageItems.id, sourceItemId)).limit(1))[0];
  if (!source || source.status === "deleted") throw new Error("صنف الفاتورة السابقة غير متاح");
  if (source.shortageDayId === targetDay.id) throw new Error("الصنف موجود بالفعل ضمن فاتورة اليوم");
  const duplicate = (await db.select({ id: shortageItems.id }).from(shortageItems).where(and(
    eq(shortageItems.shortageDayId, targetDay.id),
    eq(shortageItems.productName, source.productName),
    eq(shortageItems.dosageForm, source.dosageForm),
    eq(shortageItems.quantity, source.quantity),
    inArray(shortageItems.status, ["open", "received"]),
  )).limit(1))[0];
  const deletedCopy = (await db.select({ id: shortageItems.id }).from(shortageItems).where(and(
    eq(shortageItems.shortageDayId, targetDay.id),
    eq(shortageItems.rolloverSourceItemId, source.id),
    eq(shortageItems.status, "deleted"),
  )).limit(1))[0];
  const decision = decideArchivedTransfer(duplicate?.id, deletedCopy?.id);
  if (decision.action === "existing") return { added: false, itemId: decision.itemId, restored: false };
  if (decision.action === "restore") {
    await db.update(shortageItems).set({
      productName: source.productName,
      dosageForm: source.dosageForm,
      quantity: source.quantity,
      priority: source.priority,
      status: "open",
      notes: source.notes,
      suggestedSupplierId: source.suggestedSupplierId,
      deletedAt: null,
      deletedByUserId: null,
      receivedAt: null,
      receivedByUserId: null,
      createdByUserId: actorUserId,
    }).where(eq(shortageItems.id, decision.itemId));
    await createAudit("shortage_manually_restored_from_archive", "shortage_item", decision.itemId, actorUserId, `source:${sourceItemId}; ${source.productName}`);
    return { added: true, itemId: decision.itemId, restored: true };
  }
  const result = await db.insert(shortageItems).values({
    shortageDayId: targetDay.id,
    productName: source.productName,
    dosageForm: source.dosageForm,
    quantity: source.quantity,
    priority: source.priority,
    status: "open",
    notes: source.notes,
    suggestedSupplierId: source.suggestedSupplierId,
    rolloverSourceItemId: source.id,
    createdByUserId: actorUserId,
  });
  const itemId = Number(result[0].insertId);
  await createAudit("shortage_manually_added_from_archive", "shortage_item", itemId, actorUserId, `source:${sourceItemId}; ${source.productName}`);
  return { added: true, itemId, restored: false };
}

export async function setShortageItemStatus(itemId: number, status: "open" | "received", actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const item = (await db.select().from(shortageItems).where(eq(shortageItems.id, itemId)).limit(1))[0];
  if (!item || item.status === "deleted") throw new Error("الصنف غير موجود");
  await db.update(shortageItems).set({
    status,
    receivedAt: status === "received" ? new Date() : null,
    receivedByUserId: status === "received" ? actorUserId : null,
  }).where(eq(shortageItems.id, itemId));
  await createAudit(status === "received" ? "shortage_received" : "shortage_reopened", "shortage_item", itemId, actorUserId, item.productName);
}

export async function softDeleteShortageItem(itemId: number, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const item = (await db.select().from(shortageItems).where(eq(shortageItems.id, itemId)).limit(1))[0];
  if (!item || item.status === "deleted") throw new Error("الصنف غير موجود");
  await db.update(shortageItems).set({ status: "deleted", deletedAt: new Date(), deletedByUserId: actorUserId }).where(eq(shortageItems.id, itemId));
  await createAudit("shortage_deleted", "shortage_item", itemId, actorUserId, item.productName);
}

export async function listSuppliers(includeInactive = true) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shortageSuppliers)
    .where(includeInactive ? isNull(shortageSuppliers.deletedAt) : and(isNull(shortageSuppliers.deletedAt), eq(shortageSuppliers.active, true)))
    .orderBy(shortageSuppliers.name);
}

export async function saveSupplier(input: { id?: number; name: string; whatsappNumber: string; notes?: string | null; active: boolean }, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  if (input.id) {
    await db.update(shortageSuppliers).set({ name: input.name, whatsappNumber: input.whatsappNumber, notes: input.notes ?? null, active: input.active }).where(eq(shortageSuppliers.id, input.id));
    await createAudit("supplier_updated", "supplier", input.id, actorUserId, input.name);
    return input.id;
  }
  const result = await db.insert(shortageSuppliers).values({ name: input.name, whatsappNumber: input.whatsappNumber, notes: input.notes ?? null, active: input.active });
  const id = Number(result[0].insertId);
  await createAudit("supplier_created", "supplier", id, actorUserId, input.name);
  return id;
}

export async function deleteSupplier(supplierId: number, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const supplier = (await db.select().from(shortageSuppliers).where(eq(shortageSuppliers.id, supplierId)).limit(1))[0];
  if (!supplier || supplier.deletedAt) throw new Error("المخزن غير موجود");
  await db.update(shortageSuppliers).set({ active: false, deletedAt: new Date() }).where(eq(shortageSuppliers.id, supplierId));
  await createAudit("supplier_deleted", "supplier", supplierId, actorUserId, supplier.name);
}

export async function deleteUserSafely(userId: number, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  if (userId === actorUserId) throw new Error("لا يمكن حذف حسابك الحالي");
  const target = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!target || target.deletedAt) throw new Error("المستخدم غير موجود");
  if (target.role === "admin") {
    const activeAdmins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true), isNull(users.deletedAt)));
    if (activeAdmins.length <= 1) throw new Error("لا يمكن حذف المدير الوحيد للنظام");
  }
  await db.update(users).set({ active: false, deletedAt: new Date() }).where(eq(users.id, userId));
  await createAudit("user_deleted", "user", userId, actorUserId, target.name);
}

export async function getAppSettings() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.insert(appSettings).values({ id: 1 }).onDuplicateKeyUpdate({ set: { id: sql`id` } });
  return (await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1))[0]!;
}

export async function updateAppSettings(input: {
  appName: string;
  pharmacyName: string;
  pharmacyPhone?: string | null;
  pharmacyAddress?: string | null;
  supplierMessageIntro: string;
  supplierMessageFooter: string;
  welcomeText: string;
  dashboardSubtitle: string;
  accentColor: string;
  showDashboardStats?: boolean;
  showShortageForm?: boolean;
  showPriorityPicker?: boolean;
  showSupplierPicker?: boolean;
  showNotesField?: boolean;
  showInvoiceArchive?: boolean;
  enabledDosageForms?: string | null;
  quantityPresets?: string;
  visibleNavigation?: string | null;
  topNotice?: string | null;
  navigationOrder?: string | null;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await getAppSettings();
  const current = await getAppSettings();
  await db.update(appSettings).set({
    appName: input.appName,
    pharmacyName: input.pharmacyName,
    pharmacyPhone: input.pharmacyPhone ?? null,
    pharmacyAddress: input.pharmacyAddress ?? null,
    supplierMessageIntro: input.supplierMessageIntro,
    supplierMessageFooter: input.supplierMessageFooter,
    welcomeText: input.welcomeText,
    dashboardSubtitle: input.dashboardSubtitle,
    accentColor: input.accentColor,
    showDashboardStats: input.showDashboardStats ?? current.showDashboardStats,
    showShortageForm: input.showShortageForm ?? current.showShortageForm,
    showPriorityPicker: input.showPriorityPicker ?? current.showPriorityPicker,
    showSupplierPicker: input.showSupplierPicker ?? current.showSupplierPicker,
    showNotesField: input.showNotesField ?? current.showNotesField,
    showInvoiceArchive: input.showInvoiceArchive ?? current.showInvoiceArchive,
    enabledDosageForms: input.enabledDosageForms ?? current.enabledDosageForms,
    quantityPresets: input.quantityPresets ?? current.quantityPresets,
    visibleNavigation: input.visibleNavigation ?? current.visibleNavigation,
    topNotice: input.topNotice ?? null,
    navigationOrder: input.navigationOrder ?? null,
    updatedByUserId: input.actorUserId,
  }).where(eq(appSettings.id, 1));
  await createAudit("app_settings_updated", "app_settings", 1, input.actorUserId, input.appName);
  return getAppSettings();
}

export async function listVisibleMessages(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: appMessages.id,
    title: appMessages.title,
    body: appMessages.body,
    kind: appMessages.kind,
    targetUserId: appMessages.targetUserId,
    createdAt: appMessages.createdAt,
    expiresAt: appMessages.expiresAt,
    readAt: appMessageReads.readAt,
  }).from(appMessages)
    .leftJoin(appMessageReads, and(eq(appMessageReads.messageId, appMessages.id), eq(appMessageReads.userId, userId)))
    .where(and(eq(appMessages.active, true), or(isNull(appMessages.targetUserId), eq(appMessages.targetUserId, userId)), or(isNull(appMessages.expiresAt), gt(appMessages.expiresAt, new Date()))))
    .orderBy(desc(appMessages.createdAt));
}

export async function listAllMessages() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: appMessages.id,
    title: appMessages.title,
    body: appMessages.body,
    kind: appMessages.kind,
    targetUserId: appMessages.targetUserId,
    targetUserName: users.name,
    active: appMessages.active,
    createdAt: appMessages.createdAt,
  }).from(appMessages).leftJoin(users, eq(appMessages.targetUserId, users.id)).orderBy(desc(appMessages.createdAt));
}

export async function createAppMessage(input: {
  title: string;
  body: string;
  kind: "info" | "success" | "warning" | "alert";
  targetUserId?: number | null;
  expiresAt?: Date | null;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const result = await db.insert(appMessages).values({ ...input, targetUserId: input.targetUserId ?? null, expiresAt: input.expiresAt ?? null });
  const id = Number(result[0].insertId);
  await createAudit("message_created", "app_message", id, input.createdByUserId, input.title);
  return id;
}

export async function markMessageRead(messageId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.insert(appMessageReads).values({ messageId, userId }).onDuplicateKeyUpdate({ set: { readAt: new Date() } });
}

export async function archiveAppMessage(messageId: number, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(appMessages).set({ active: false }).where(eq(appMessages.id, messageId));
  await createAudit("message_archived", "app_message", messageId, actorUserId);
}

export async function createSupplierOrder(input: { supplierId: number; itemIds: number[]; createdByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const day = await getOrCreateShortageDay();
  const supplier = (await db.select().from(shortageSuppliers).where(and(eq(shortageSuppliers.id, input.supplierId), eq(shortageSuppliers.active, true))).limit(1))[0];
  if (!supplier) throw new Error("المخزن المحدد غير متاح");
  const items = await db.select().from(shortageItems).where(and(eq(shortageItems.shortageDayId, day.id), eq(shortageItems.status, "open"), inArray(shortageItems.id, input.itemIds)));
  if (items.length !== input.itemIds.length) throw new Error("تأكد من أن كل الأصناف المختارة مفتوحة ومن قائمة اليوم");
  const { buildWhatsAppMessage, whatsappUrl } = await import("./shortagesDomain");
  const settings = await getAppSettings();
  const messageText = buildWhatsAppMessage({ dayKey: day.dayKey, supplierName: supplier.name, items, settings });
  const url = whatsappUrl(supplier.whatsappNumber, messageText);
  const result = await db.insert(shortageSupplierOrders).values({ supplierId: supplier.id, shortageDayId: day.id, messageText, whatsappUrl: url, createdByUserId: input.createdByUserId });
  const orderId = Number(result[0].insertId);
  await db.insert(shortageSupplierOrderItems).values(items.map(item => ({
    orderId,
    shortageItemId: item.id,
    productNameSnapshot: item.productName,
    prioritySnapshot: item.priority,
    notesSnapshot: item.notes,
  })));
  await createAudit("supplier_order_prepared", "supplier_order", orderId, input.createdByUserId, `supplier:${supplier.name}; count:${items.length}`);
  return { orderId, messageText, whatsappUrl: url };
}

export async function getActivityLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: shortageActivityLogs.id,
    action: shortageActivityLogs.action,
    entityType: shortageActivityLogs.entityType,
    entityId: shortageActivityLogs.entityId,
    details: shortageActivityLogs.details,
    createdAt: shortageActivityLogs.createdAt,
    actorName: users.name,
  }).from(shortageActivityLogs)
    .leftJoin(users, eq(shortageActivityLogs.actorUserId, users.id))
    .orderBy(desc(shortageActivityLogs.createdAt))
    .limit(80);
}

export async function rolloverOpenShortages(targetDayKey = cairoDayKey()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const sourceDayKey = previousDayKey(targetDayKey);
  return db.transaction(async tx => {
    await tx.insert(shortageDays).values({ dayKey: targetDayKey }).onDuplicateKeyUpdate({ set: { dayKey: sql`dayKey` } });
    const targetDay = (await tx.select().from(shortageDays).where(eq(shortageDays.dayKey, targetDayKey)).limit(1))[0]!;
    const mostRecentOpenSource = await tx.select({ id: shortageDays.id, dayKey: shortageDays.dayKey })
      .from(shortageDays).innerJoin(shortageItems, eq(shortageItems.shortageDayId, shortageDays.id))
      .where(and(lt(shortageDays.dayKey, targetDayKey), eq(shortageItems.status, "open")))
      .orderBy(desc(shortageDays.dayKey)).limit(1);
    const sourceDay = mostRecentOpenSource[0];
    if (!sourceDay) return { sourceDayKey, targetDayKey, copied: 0 };
    const sources = await tx.select().from(shortageItems).where(eq(shortageItems.shortageDayId, sourceDay.id));
    if (sources.length === 0) return { sourceDayKey, targetDayKey, copied: 0 };
    const existing = await tx.select({ sourceId: shortageItems.rolloverSourceItemId }).from(shortageItems)
      .where(and(eq(shortageItems.shortageDayId, targetDay.id), inArray(shortageItems.rolloverSourceItemId, sources.map(source => source.id))));
    const pending = selectRolloverCandidates(sources, existing.map(row => row.sourceId));
    if (pending.length > 0) {
      await tx.insert(shortageItems).values(pending.map(source => ({
        shortageDayId: targetDay.id,
        productName: source.productName,
        dosageForm: source.dosageForm,
        quantity: source.quantity,
        priority: source.priority,
        status: "open" as const,
        notes: source.notes,
        suggestedSupplierId: source.suggestedSupplierId,
        rolloverSourceItemId: source.id,
        createdByUserId: source.createdByUserId,
      })));
      await tx.insert(shortageActivityLogs).values({
        action: "shortages_rolled_over",
        entityType: "shortage_day",
        entityId: targetDay.id,
        details: `from:${sourceDayKey}; copied:${pending.length}`,
        actorUserId: null,
      });
    }
    return { sourceDayKey, targetDayKey, copied: pending.length };
  });
}
