import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createLocalSession, hashPassword, verifyPassword } from "./localAuth";
import {
  createShortageItem,
  createSupplierOrder,
  ensureRolloverSettings,
  getActivityLogs,
  getLocalUserByUsername,
  getTodayDashboard,
  listLoginAccounts,
  listSuppliers,
  listUsers,
  rolloverOpenShortages,
  saveSupplier,
  setShortageItemStatus,
  softDeleteShortageItem,
} from "./db";
import { normalizeEgyptianWhatsApp } from "./shortagesDomain";
import { shortageRolloverSettings, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { getDb } from "./db";

const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === "user") throw new TRPCError({ code: "FORBIDDEN", message: "هذه العملية متاحة للمشرفين والمديرين فقط" });
  return next();
});

const publicUser = (user: NonNullable<typeof users.$inferSelect>) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  role: user.role,
  active: user.active,
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
  shortages: router({
    dashboard: protectedProcedure.query(() => getTodayDashboard()),
    create: protectedProcedure.input(z.object({
      productName: z.string().trim().min(1).max(255),
      priority: z.enum(["normal", "important", "urgent"]),
      suggestedSupplierId: z.number().int().positive().nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    })).mutation(({ ctx, input }) => createShortageItem({ ...input, createdByUserId: ctx.user.id })),
    setStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["open", "received"]) }))
      .mutation(({ ctx, input }) => setShortageItemStatus(input.id, input.status, ctx.user.id)),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => softDeleteShortageItem(input.id, ctx.user.id)),
    prepareWhatsApp: protectedProcedure.input(z.object({ supplierId: z.number().int().positive(), itemIds: z.array(z.number().int().positive()).min(1) }))
      .mutation(({ ctx, input }) => createSupplierOrder({ ...input, createdByUserId: ctx.user.id })),
    activity: protectedProcedure.query(() => getActivityLogs()),
  }),
  suppliers: router({
    list: protectedProcedure.query(() => listSuppliers()),
    save: managerProcedure.input(z.object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1).max(160),
      whatsappNumber: z.string().trim().min(7).max(32),
      notes: z.string().trim().max(1000).nullable().optional(),
      active: z.boolean().default(true),
    })).mutation(({ ctx, input }) => saveSupplier({ ...input, whatsappNumber: normalizeEgyptianWhatsApp(input.whatsappNumber) }, ctx.user.id)),
  }),
  management: router({
    users: adminProcedure.query(() => listUsers()),
    saveUser: adminProcedure.input(z.object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1).max(128),
      username: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9_.-]+$/, "اسم المستخدم يقبل الحروف الإنجليزية والأرقام فقط"),
      role: z.enum(["user", "supervisor", "admin"]),
      active: z.boolean().default(true),
      password: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      if (!input.id && !input.password) throw new TRPCError({ code: "BAD_REQUEST", message: "كلمة المرور مطلوبة للحساب الجديد" });
      const values = { name: input.name, username: input.username, role: input.role, active: input.active } as const;
      if (input.id) {
        await db.update(users).set({ ...values, ...(input.password !== undefined ? { passwordHash: await hashPassword(input.password) } : {}) }).where(eq(users.id, input.id));
        return input.id;
      }
      const result = await db.insert(users).values({ ...values, passwordHash: await hashPassword(input.password!) });
      return Number(result[0].insertId);
    }),
    resetPassword: adminProcedure.input(z.object({ id: z.number().int().positive(), password: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
        await db.update(users).set({ passwordHash: await hashPassword(input.password) }).where(eq(users.id, input.id));
      }),
  }),
  rollover: router({
    settings: managerProcedure.query(() => ensureRolloverSettings()),
    updateSettings: managerProcedure.input(z.object({ enabled: z.boolean(), heartbeatTaskUid: z.string().trim().max(65).nullable().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
        await db.update(shortageRolloverSettings).set({ enabled: input.enabled, ...(input.heartbeatTaskUid !== undefined ? { scheduleCronTaskUid: input.heartbeatTaskUid } : {}) }).where(eq(shortageRolloverSettings.id, 1));
        return ensureRolloverSettings();
      }),
    runNow: managerProcedure.mutation(() => rolloverOpenShortages()),
  }),
});

export type AppRouter = typeof appRouter;
