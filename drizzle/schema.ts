import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Kept nullable only for template compatibility; local login exclusively uses username/passwordHash. */
  openId: varchar("openId", { length: 64 }),
  name: varchar("name", { length: 128 }).notNull(),
  username: varchar("username", { length: 64 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "supervisor", "admin"]).default("user").notNull(),
  active: boolean("active").default(true).notNull(),
  permissions: text("permissions"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
}, table => [
  uniqueIndex("users_open_id_unique").on(table.openId),
  uniqueIndex("users_username_unique").on(table.username),
  index("users_role_active_index").on(table.role, table.active),
]);

export const shortageDays = mysqlTable("shortage_days", {
  id: int("id").autoincrement().primaryKey(),
  dayKey: varchar("dayKey", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("shortage_days_day_key_unique").on(table.dayKey)]);

export const shortageSuppliers = mysqlTable("shortage_suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  whatsappNumber: varchar("whatsappNumber", { length: 16 }).notNull(),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("shortage_suppliers_active_index").on(table.active)]);

export const shortageItems = mysqlTable("shortage_items", {
  id: int("id").autoincrement().primaryKey(),
  shortageDayId: int("shortageDayId").notNull().references(() => shortageDays.id),
  productName: varchar("productName", { length: 255 }).notNull(),
  priority: mysqlEnum("priority", ["normal", "important", "urgent"]).default("normal").notNull(),
  status: mysqlEnum("status", ["open", "received", "deleted"]).default("open").notNull(),
  notes: text("notes"),
  suggestedSupplierId: int("suggestedSupplierId").references(() => shortageSuppliers.id),
  receivedAt: timestamp("receivedAt"),
  receivedByUserId: int("receivedByUserId").references(() => users.id),
  deletedAt: timestamp("deletedAt"),
  deletedByUserId: int("deletedByUserId").references(() => users.id),
  rolloverSourceItemId: int("rolloverSourceItemId"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("shortage_items_day_status_index").on(table.shortageDayId, table.status),
  index("shortage_items_supplier_index").on(table.suggestedSupplierId),
  uniqueIndex("shortage_items_rollover_source_unique").on(table.shortageDayId, table.rolloverSourceItemId),
]);

export const shortageSupplierOrders = mysqlTable("shortage_supplier_orders", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull().references(() => shortageSuppliers.id),
  shortageDayId: int("shortageDayId").notNull().references(() => shortageDays.id),
  messageText: text("messageText").notNull(),
  whatsappUrl: text("whatsappUrl").notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  preparedAt: timestamp("preparedAt").defaultNow().notNull(),
}, table => [
  index("shortage_supplier_orders_day_index").on(table.shortageDayId),
  index("shortage_supplier_orders_supplier_index").on(table.supplierId),
]);

export const shortageSupplierOrderItems = mysqlTable("shortage_supplier_order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => shortageSupplierOrders.id),
  shortageItemId: int("shortageItemId").notNull().references(() => shortageItems.id),
  productNameSnapshot: varchar("productNameSnapshot", { length: 255 }).notNull(),
  prioritySnapshot: mysqlEnum("prioritySnapshot", ["normal", "important", "urgent"]).notNull(),
  notesSnapshot: text("notesSnapshot"),
}, table => [
  index("shortage_supplier_order_items_order_index").on(table.orderId),
  index("shortage_supplier_order_items_item_index").on(table.shortageItemId),
]);

export const shortageRolloverSettings = mysqlTable("shortage_rollover_settings", {
  id: int("id").primaryKey(),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Africa/Cairo"),
  hour: int("hour").notNull().default(0),
  minute: int("minute").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("shortage_rollover_task_uid_index").on(table.scheduleCronTaskUid)]);

export const shortageActivityLogs = mysqlTable("shortage_activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  details: text("details"),
  actorUserId: int("actorUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("shortage_activity_entity_index").on(table.entityType, table.entityId),
  index("shortage_activity_created_index").on(table.createdAt),
]);

export const appSettings = mysqlTable("app_settings", {
  id: int("id").primaryKey(),
  appName: varchar("appName", { length: 120 }).notNull().default("نواقص الصيدلية"),
  welcomeText: varchar("welcomeText", { length: 255 }).notNull().default("كل نقص، وكل مخزن، في قائمة يومية واضحة."),
  dashboardSubtitle: varchar("dashboardSubtitle", { length: 255 }).notNull().default("تابع حالة الصنف من التسجيل حتى الاستلام دون فقدان سجل اليوم."),
  accentColor: varchar("accentColor", { length: 16 }).notNull().default("#0f766e"),
  topNotice: varchar("topNotice", { length: 255 }),
  navigationOrder: text("navigationOrder"),
  updatedByUserId: int("updatedByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const appMessages = mysqlTable("app_messages", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  kind: mysqlEnum("kind", ["info", "success", "warning", "alert"]).default("info").notNull(),
  targetUserId: int("targetUserId").references(() => users.id),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("app_messages_target_active_index").on(table.targetUserId, table.active),
  index("app_messages_created_index").on(table.createdAt),
]);

export const appMessageReads = mysqlTable("app_message_reads", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull().references(() => appMessages.id),
  userId: int("userId").notNull().references(() => users.id),
  readAt: timestamp("readAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("app_message_reads_message_user_unique").on(table.messageId, table.userId),
  index("app_message_reads_user_index").on(table.userId),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
