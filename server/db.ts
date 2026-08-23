import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  shortageActivityLogs,
  shortageDays,
  shortageItems,
  shortageRolloverSettings,
  shortageSupplierOrderItems,
  shortageSupplierOrders,
  shortageSuppliers,
  users,
} from "../drizzle/schema";
import { cairoDayKey, previousDayKey } from "./shortagesDomain";

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
  const day = await getOrCreateShortageDay(dayKey);
  const items = await db.select({
    id: shortageItems.id,
    productName: shortageItems.productName,
    priority: shortageItems.priority,
    status: shortageItems.status,
    notes: shortageItems.notes,
    suggestedSupplierId: shortageItems.suggestedSupplierId,
    suggestedSupplierName: shortageSuppliers.name,
    receivedAt: shortageItems.receivedAt,
    createdAt: shortageItems.createdAt,
  }).from(shortageItems)
    .leftJoin(shortageSuppliers, eq(shortageItems.suggestedSupplierId, shortageSuppliers.id))
    .where(and(eq(shortageItems.shortageDayId, day.id), inArray(shortageItems.status, ["open", "received"])))
    .orderBy(desc(shortageItems.createdAt));
  return { day, items };
}

export async function createShortageItem(input: {
  productName: string;
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
    .where(includeInactive ? undefined : eq(shortageSuppliers.active, true))
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

export async function createSupplierOrder(input: { supplierId: number; itemIds: number[]; createdByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const day = await getOrCreateShortageDay();
  const supplier = (await db.select().from(shortageSuppliers).where(and(eq(shortageSuppliers.id, input.supplierId), eq(shortageSuppliers.active, true))).limit(1))[0];
  if (!supplier) throw new Error("المخزن المحدد غير متاح");
  const items = await db.select().from(shortageItems).where(and(eq(shortageItems.shortageDayId, day.id), eq(shortageItems.status, "open"), inArray(shortageItems.id, input.itemIds)));
  if (items.length !== input.itemIds.length) throw new Error("تأكد من أن كل الأصناف المختارة مفتوحة ومن قائمة اليوم");
  const { buildWhatsAppMessage, whatsappUrl } = await import("./shortagesDomain");
  const messageText = buildWhatsAppMessage({ dayKey: day.dayKey, supplierName: supplier.name, items });
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
    const sourceDay = (await tx.select().from(shortageDays).where(eq(shortageDays.dayKey, sourceDayKey)).limit(1))[0];
    if (!sourceDay) return { sourceDayKey, targetDayKey, copied: 0 };
    const sources = await tx.select().from(shortageItems).where(and(eq(shortageItems.shortageDayId, sourceDay.id), eq(shortageItems.status, "open")));
    if (sources.length === 0) return { sourceDayKey, targetDayKey, copied: 0 };
    const existing = await tx.select({ sourceId: shortageItems.rolloverSourceItemId }).from(shortageItems)
      .where(and(eq(shortageItems.shortageDayId, targetDay.id), inArray(shortageItems.rolloverSourceItemId, sources.map(source => source.id))));
    const existingIds = new Set(existing.map(row => row.sourceId));
    const pending = sources.filter(source => !existingIds.has(source.id));
    if (pending.length > 0) {
      await tx.insert(shortageItems).values(pending.map(source => ({
        shortageDayId: targetDay.id,
        productName: source.productName,
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
