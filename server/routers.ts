import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createLocalSession, hashPassword, verifyPassword } from "./localAuth";
import {
  archiveAppMessage,
  createAppMessage,
  createShortageItem,
  createSupplierOrder,
  deleteSupplier,
  deleteUserSafely,
  ensureRolloverSettings,
  getAppSettings,
  getActivityLogs,
  getLocalUserById,
  getLocalUserByUsername,
  getShortageDayInvoice,
  getUserProfile,
  getTodayDashboard,
  listLoginAccounts,
  listAllMessages,
  listAchievementBoard,
  listShortageDayArchive,
  listSuppliers,
  listUsers,
  listVisibleMessages,
  markMessageRead,
  manuallyAddArchivedShortage,
  rolloverOpenShortages,
  saveSupplier,
  setShortageItemStatus,
  softDeleteShortageItem,
  updateAppSettings,
  updateOwnProfile,
} from "./db";
import { normalizeEgyptianWhatsApp } from "./shortagesDomain";
import { shortageRolloverSettings, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { canUsePermission, permissionKeys, serializePermissions, type PermissionKey } from "./permissions";

const permissionProcedure = (permission: PermissionKey) => protectedProcedure.use(({ ctx, next }) => {
  if (!canUsePermission(ctx.user, permission)) throw new TRPCError({ code: "FORBIDDEN", message: "ليست لديك صلاحية لتنفيذ هذه العملية. تواصل مع المشرف لتفعيلها." });
  return next();
});

const publicUser = (user: NonNullable<typeof users.$inferSelect>) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  role: user.role,
  active: user.active,
  permissions: user.permissions,
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    loginAccounts: publicProcedure.input(z.object({ mode: z.enum(["user", "manager"]) })).query(({ input }) => listLoginAccounts(input.mode)),
    login: publicProcedure.input(z.object({
      mode: z.enum(["user", "manager"]),
      username: z.string().min(1),
      password: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const user = await getLocalUserByUsername(input.username);
      const isCorrectMode = input.mode === "user" ? user?.role === "user" : user?.role === "supervisor" || user?.role === "admin";
      if (!user || !user.active || !isCorrectMode || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "بيانات الدخول غير صحيحة أو الحساب غير متاح" });
      }
      const token = await createLocalSession(user);
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 365 });
      return publicUser(user);
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  profile: router({
    me: protectedProcedure.query(({ ctx }) => getUserProfile(ctx.user.id)),
    leaderboard: protectedProcedure.query(() => listAchievementBoard()),
    update: protectedProcedure.input(z.object({
      name: z.string().trim().min(1).max(128),
      username: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9_.-]+$/, "اسم المستخدم يقبل الحروف الإنجليزية والأرقام فقط"),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(4).max(128).optional(),
    })).mutation(async ({ ctx, input }) => {
      if (input.newPassword) {
        const current = await getLocalUserById(ctx.user.id);
        if (!current || !(await verifyPassword(input.currentPassword ?? "", current.passwordHash))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور الحالية غير صحيحة" });
        }
      }
      try {
        return await updateOwnProfile({ userId: ctx.user.id, name: input.name, username: input.username, ...(input.newPassword ? { passwordHash: await hashPassword(input.newPassword) } : {}) });
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "تعذر تحديث الملف الشخصي" });
      }
    }),
  }),
  shortages: router({
    dashboard: protectedProcedure.query(() => getTodayDashboard()),
    archive: protectedProcedure.query(() => listShortageDayArchive()),
    invoice: protectedProcedure.input(z.object({ dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ الفاتورة غير صحيح") }))
      .query(({ input }) => getShortageDayInvoice(input.dayKey)),
    create: permissionProcedure("shortages_create").input(z.object({
      productName: z.string().trim().min(1).max(255),
      dosageForm: z.enum(["أقراص", "شراب", "مرهم", "نقط", "كريم", "حقن"]),
      quantity: z.number().int().min(1).max(999),
      priority: z.enum(["normal", "important", "urgent"]),
      suggestedSupplierId: z.number().int().positive().nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    })).mutation(({ ctx, input }) => createShortageItem({ ...input, createdByUserId: ctx.user.id })),
    setStatus: permissionProcedure("shortages_update").input(z.object({ id: z.number().int().positive(), status: z.enum(["open", "received"]) }))
      .mutation(({ ctx, input }) => setShortageItemStatus(input.id, input.status, ctx.user.id)),
    delete: permissionProcedure("shortages_delete").input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => softDeleteShortageItem(input.id, ctx.user.id)),
    addFromArchive: permissionProcedure("shortages_create").input(z.object({ sourceItemId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => manuallyAddArchivedShortage(input.sourceItemId, ctx.user.id)),
    prepareWhatsApp: permissionProcedure("orders_prepare").input(z.object({ supplierId: z.number().int().positive(), itemIds: z.array(z.number().int().positive()).min(1) }))
      .mutation(({ ctx, input }) => createSupplierOrder({ ...input, createdByUserId: ctx.user.id })),
    activity: permissionProcedure("activity_view").query(() => getActivityLogs()),
  }),
  suppliers: router({
    list: protectedProcedure.query(() => listSuppliers()),
    save: permissionProcedure("suppliers_manage").input(z.object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1).max(160),
      whatsappNumber: z.string().trim().min(7).max(32),
      notes: z.string().trim().max(1000).nullable().optional(),
      active: z.boolean().default(true),
    })).mutation(({ ctx, input }) => saveSupplier({ ...input, whatsappNumber: normalizeEgyptianWhatsApp(input.whatsappNumber) }, ctx.user.id)),
    delete: permissionProcedure("suppliers_delete").input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteSupplier(input.id, ctx.user.id)),
  }),
  management: router({
    users: permissionProcedure("users_manage").query(() => listUsers()),
    saveUser: permissionProcedure("users_manage").input(z.object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1).max(128),
      username: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9_.-]+$/, "اسم المستخدم يقبل الحروف الإنجليزية والأرقام فقط"),
      role: z.enum(["user", "supervisor", "admin"]),
      active: z.boolean().default(true),
      password: z.string().optional(),
      permissions: z.array(z.enum(permissionKeys)).default([]),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && input.role === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء أو ترقية مدير النظام متاح للمدير فقط" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      if (!input.id && !input.password) throw new TRPCError({ code: "BAD_REQUEST", message: "كلمة المرور مطلوبة للحساب الجديد" });
      const values = { name: input.name, username: input.username, role: input.role, active: input.active, permissions: serializePermissions(input.permissions) } as const;
      if (input.id) {
        await db.update(users).set({ ...values, ...(input.password !== undefined ? { passwordHash: await hashPassword(input.password) } : {}) }).where(eq(users.id, input.id));
        return input.id;
      }
      const result = await db.insert(users).values({ ...values, passwordHash: await hashPassword(input.password!) });
      return Number(result[0].insertId);
    }),
    resetPassword: permissionProcedure("users_manage").input(z.object({ id: z.number().int().positive(), password: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
        await db.update(users).set({ passwordHash: await hashPassword(input.password) }).where(eq(users.id, input.id));
      }),
    deleteUser: permissionProcedure("users_manage").input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteUserSafely(input.id, ctx.user.id)),
  }),
  presentation: router({
    get: publicProcedure.query(() => getAppSettings()),
    update: permissionProcedure("settings_manage").input(z.object({
      appName: z.string().trim().min(1).max(120),
      pharmacyName: z.string().trim().min(1).max(160),
      pharmacyPhone: z.string().trim().max(32).nullable().optional(),
      pharmacyAddress: z.string().trim().max(255).nullable().optional(),
      supplierMessageIntro: z.string().trim().min(1).max(300),
      supplierMessageFooter: z.string().trim().min(1).max(300),
      welcomeText: z.string().trim().min(1).max(255),
      dashboardSubtitle: z.string().trim().min(1).max(255),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "اختر لونًا بصيغة #RRGGBB"),
      showDashboardStats: z.boolean().optional(),
      showShortageForm: z.boolean().optional(),
      showPriorityPicker: z.boolean().optional(),
      showSupplierPicker: z.boolean().optional(),
      showNotesField: z.boolean().optional(),
      showInvoiceArchive: z.boolean().optional(),
      enabledDosageForms: z.string().trim().max(160).nullable().optional(),
      quantityPresets: z.string().trim().regex(/^\d+(,\d+){0,7}$/).optional(),
      visibleNavigation: z.string().trim().max(160).nullable().optional(),
      topNotice: z.string().trim().max(255).nullable().optional(),
      navigationOrder: z.string().max(1000).nullable().optional(),
    })).mutation(({ ctx, input }) => updateAppSettings({ ...input, actorUserId: ctx.user.id })),
  }),
  messages: router({
    inbox: protectedProcedure.query(({ ctx }) => listVisibleMessages(ctx.user.id)),
    read: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => markMessageRead(input.id, ctx.user.id)),
    all: permissionProcedure("messages_manage").query(() => listAllMessages()),
    create: permissionProcedure("messages_manage").input(z.object({
      title: z.string().trim().min(1).max(180),
      body: z.string().trim().min(1).max(2000),
      kind: z.enum(["info", "success", "warning", "alert"]),
      targetUserId: z.number().int().positive().nullable().optional(),
    })).mutation(({ ctx, input }) => createAppMessage({ ...input, createdByUserId: ctx.user.id })),
    archive: permissionProcedure("messages_manage").input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => archiveAppMessage(input.id, ctx.user.id)),
  }),
  rollover: router({
    settings: permissionProcedure("rollover_manage").query(() => ensureRolloverSettings()),
    updateSettings: permissionProcedure("rollover_manage").input(z.object({ enabled: z.boolean(), heartbeatTaskUid: z.string().trim().max(65).nullable().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
        await db.update(shortageRolloverSettings).set({ enabled: input.enabled, ...(input.heartbeatTaskUid !== undefined ? { scheduleCronTaskUid: input.heartbeatTaskUid } : {}) }).where(eq(shortageRolloverSettings.id, 1));
        return ensureRolloverSettings();
      }),
    runNow: permissionProcedure("rollover_manage").mutation(() => rolloverOpenShortages()),
  }),
});

export type AppRouter = typeof appRouter;
