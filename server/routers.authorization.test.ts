import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  archiveAppMessage: vi.fn(), createAppMessage: vi.fn(), createGroupChatMessage: vi.fn(), createShortageItem: vi.fn(), createSupplierOrder: vi.fn(),
  deleteSupplier: vi.fn(), deleteGroupChatMessage: vi.fn(), deleteUserSafely: vi.fn(), ensureRolloverSettings: vi.fn(), getAppSettings: vi.fn(),
  getActivityLogs: vi.fn(), getLocalUserById: vi.fn(), getLocalUserByUsername: vi.fn(), getShortageDayInvoice: vi.fn(), getUserProfile: vi.fn(), getTodayDashboard: vi.fn(),
  listLoginAccounts: vi.fn(), listAllMessages: vi.fn(), listGroupChatMessages: vi.fn(), listAchievementBoard: vi.fn(), listShortageDayArchive: vi.fn(), listSuppliers: vi.fn(), listUsers: vi.fn(),
  listVisibleMessages: vi.fn(), markMessageRead: vi.fn(), manuallyAddArchivedShortage: vi.fn(), rolloverOpenShortages: vi.fn(), saveSupplier: vi.fn(), setShortageItemStatus: vi.fn(),
  softDeleteShortageItem: vi.fn(), updateShortageItem: vi.fn(), updateAppSettings: vi.fn(), updateOwnProfile: vi.fn(), getDb: vi.fn(),
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

  it("enforces chat enabled and user-send settings through the real send procedure", async () => {
    db.createGroupChatMessage.mockResolvedValue(44);
    db.getAppSettings.mockResolvedValueOnce({ chatEnabled: false, chatUsersCanSend: true });
    await expect(callerFor(user(["chat_send"])).chat.send({ body: "مرحبًا" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.getAppSettings.mockResolvedValueOnce({ chatEnabled: true, chatUsersCanSend: false });
    await expect(callerFor(user(["chat_send"])).chat.send({ body: "مرحبًا" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.getAppSettings.mockResolvedValueOnce({ chatEnabled: true, chatUsersCanSend: false });
    await callerFor(supervisor).chat.send({ body: "رسالة مشرف" });
    expect(db.createGroupChatMessage).toHaveBeenLastCalledWith("رسالة مشرف", 2);
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
