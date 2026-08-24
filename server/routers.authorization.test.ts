import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  archiveAppMessage: vi.fn(), createAppMessage: vi.fn(), createGroupChatMessage: vi.fn(), createShortageItem: vi.fn(), createSupplierOrder: vi.fn(),
  deleteSupplier: vi.fn(), deleteGroupChatMessage: vi.fn(), deleteUserSafely: vi.fn(), ensureRolloverSettings: vi.fn(), getAppSettings: vi.fn(),
  getActivityLogs: vi.fn(), getLocalUserById: vi.fn(), getLocalUserByUsername: vi.fn(), getShortageDayInvoice: vi.fn(), getUserProfile: vi.fn(), getTodayDashboard: vi.fn(),
  listLoginAccounts: vi.fn(), listAllMessages: vi.fn(), listGroupChatMessages: vi.fn(), listAchievementBoard: vi.fn(), listShortageDayArchive: vi.fn(), listSuppliers: vi.fn(), listUsers: vi.fn(),
  listVisibleMessages: vi.fn(), markGroupChatMessagesRead: vi.fn(), markMessageRead: vi.fn(), manuallyAddArchivedShortage: vi.fn(), rolloverOpenShortages: vi.fn(), saveSupplier: vi.fn(), setShortageItemStatus: vi.fn(),
  softDeleteShortageItem: vi.fn(), updateShortageItem: vi.fn(), updateAppSettings: vi.fn(), updateOwnProfile: vi.fn(), getDb: vi.fn(),
  toggleGroupChatReaction: vi.fn(),
}));

vi.mock("./db", () => db);

import { appRouter } from "./routers";

const user = (permissions: string[] = []) => ({
  id: 14, name: "مستخدم اختبار", username: "test-user", role: "user" as const, active: true, permissions: JSON.stringify(permissions),
  openId: null, passwordHash: null, email: null, loginMethod: "local", deletedAt: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
});
const supervisor = { ...user([]), id: 2, role: "supervisor" as const };
const callerFor = (currentUser: ReturnType<typeof user> | typeof supervisor) => appRouter.createCaller({ user: currentUser, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext);

describe("router authorization for shortage editing and team chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getAppSettings.mockResolvedValue({ chatEnabled: true, chatUsersCanSend: true });
  });

  it("saves the full edited shortage payload only for users with shortages_update", async () => {
    db.updateShortageItem.mockResolvedValue(undefined);
    await callerFor(user(["shortages_update"])).shortages.update({ id: 31, productName: "صنف معدل", dosageForm: "شراب", quantity: 3, priority: "urgent", internalLabel: "موصى عليه", notes: "ملاحظة للفريق", suggestedSupplierId: null });
    expect(db.updateShortageItem).toHaveBeenCalledWith(expect.objectContaining({ id: 31, productName: "صنف معدل", dosageForm: "شراب", quantity: 3, priority: "urgent", internalLabel: "موصى عليه", notes: "ملاحظة للفريق", actorUserId: 14 }));
    await expect(callerFor(user(["shortages_create"])).shortages.update({ id: 31, productName: "ممنوع", dosageForm: "أقراص", quantity: 1, priority: "normal" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("persists a team label and short note when registering a new shortage", async () => {
    db.createShortageItem.mockResolvedValue(52);
    await callerFor(user(["shortages_create"])).shortages.create({ productName: "صنف جديد", dosageForm: "نقط", quantity: 2, priority: "important", internalLabel: "موصى عليه", notes: "العميل سأل عليه", suggestedSupplierId: null });
    expect(db.createShortageItem).toHaveBeenCalledWith(expect.objectContaining({ productName: "صنف جديد", dosageForm: "نقط", quantity: 2, internalLabel: "موصى عليه", notes: "العميل سأل عليه", createdByUserId: 14 }));
  });

  it("enforces chat enabled and user-send settings through the real send procedure", async () => {
    db.createGroupChatMessage.mockResolvedValue(44);
    db.getAppSettings.mockResolvedValueOnce({ chatEnabled: false, chatUsersCanSend: true });
    await expect(callerFor(user()).chat.send({ body: "مرحبًا" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.getAppSettings.mockResolvedValueOnce({ chatEnabled: true, chatUsersCanSend: false });
    await expect(callerFor(user()).chat.send({ body: "مرحبًا" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.getAppSettings.mockResolvedValueOnce({ chatEnabled: true, chatUsersCanSend: false });
    await callerFor(supervisor).chat.send({ body: "رسالة مشرف" });
    expect(db.createGroupChatMessage).toHaveBeenLastCalledWith({ body: "رسالة مشرف", createdByUserId: 2 });
    db.getAppSettings.mockResolvedValueOnce({ chatEnabled: true, chatUsersCanSend: true });
    await callerFor(user()).chat.send({ body: "رسالة مستخدم" });
    expect(db.createGroupChatMessage).toHaveBeenLastCalledWith({ body: "رسالة مستخدم", createdByUserId: 14 });
    db.getAppSettings.mockResolvedValueOnce({ chatEnabled: true, chatUsersCanSend: true });
    await callerFor(user()).chat.send({ body: "رد محول", replyToMessageId: 7, forwardedFromMessageId: 6 });
    expect(db.createGroupChatMessage).toHaveBeenLastCalledWith({ body: "رد محول", replyToMessageId: 7, forwardedFromMessageId: 6, createdByUserId: 14 });
  });

  it("records reads and toggles approved emoji reactions for any signed-in user", async () => {
    db.listGroupChatMessages.mockResolvedValue([{ id: 7, readers: [{ userId: 14, name: "مستخدم اختبار" }] }]);
    db.markGroupChatMessagesRead.mockResolvedValue(undefined);
    db.toggleGroupChatReaction.mockResolvedValue(true);
    const listed = await callerFor(user()).chat.messages();
    expect(db.listGroupChatMessages).toHaveBeenCalledWith(14);
    expect(listed[0]?.readers).toEqual([{ userId: 14, name: "مستخدم اختبار" }]);
    await callerFor(user()).chat.read({ messageIds: [7, 8] });
    expect(db.markGroupChatMessagesRead).toHaveBeenCalledWith([7, 8], 14);
    await callerFor(user()).chat.react({ messageId: 7, emoji: "🔥" });
    expect(db.toggleGroupChatReaction).toHaveBeenCalledWith({ messageId: 7, emoji: "🔥", userId: 14 });
    db.toggleGroupChatReaction.mockResolvedValueOnce(false);
    await callerFor(user()).chat.react({ messageId: 7, emoji: "🔥" });
    db.toggleGroupChatReaction.mockRejectedValueOnce(new Error("الرسالة غير موجودة"));
    await expect(callerFor(user()).chat.react({ messageId: 7, emoji: "🔥" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("relays an unavailable reply or forward reference as a clear send error", async () => {
    db.getAppSettings.mockResolvedValue({ chatEnabled: true, chatUsersCanSend: true });
    db.createGroupChatMessage.mockRejectedValueOnce(new Error("تعذر العثور على الرسالة الأصلية."));
    await expect(callerFor(user()).chat.send({ body: "رد", replyToMessageId: 77 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "تعذر العثور على الرسالة الأصلية." });
  });

  it("passes moderator authority to chat deletion and relays denial for another user", async () => {
    db.deleteGroupChatMessage.mockRejectedValueOnce(new Error("لا يمكنك حذف رسالة مستخدم آخر"));
    await expect(callerFor(user(["chat_send"])).chat.delete({ id: 77 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.deleteGroupChatMessage).toHaveBeenCalledWith({ id: 77, actorUserId: 14, canModerate: false });
    db.deleteGroupChatMessage.mockResolvedValueOnce(undefined);
    await callerFor(user(["chat_send"])).chat.delete({ id: 78 });
    expect(db.deleteGroupChatMessage).toHaveBeenLastCalledWith({ id: 78, actorUserId: 14, canModerate: false });
    db.deleteGroupChatMessage.mockResolvedValueOnce(undefined);
    await callerFor(supervisor).chat.delete({ id: 77 });
    expect(db.deleteGroupChatMessage).toHaveBeenLastCalledWith({ id: 77, actorUserId: 2, canModerate: true });
  });
});
