import { describe, expect, it } from "vitest";
import { canDeleteChatMessage, canSendGroupChat, normalizeChatMessage } from "./chatDomain";

describe("group chat domain", () => {
  it("normalizes extra whitespace without removing meaningful line breaks", () => {
    expect(normalizeChatMessage("  تم التواصل مع المخزن\r\n\r\n\r\nيرجى المتابعة  ")).toBe("تم التواصل مع المخزن\n\nيرجى المتابعة");
  });

  it("allows a message author or an authorized moderator to delete a message", () => {
    expect(canDeleteChatMessage({ authorUserId: 8, actorUserId: 8, canModerate: false })).toBe(true);
    expect(canDeleteChatMessage({ authorUserId: 8, actorUserId: 3, canModerate: true })).toBe(true);
    expect(canDeleteChatMessage({ authorUserId: 8, actorUserId: 3, canModerate: false })).toBe(false);
  });

  it("blocks sending when chat is stopped or user-only sending is suspended, while allowing moderators", () => {
    expect(canSendGroupChat({ chatEnabled: false, chatUsersCanSend: true, hasSendPermission: true, canModerate: false })).toBe(false);
    expect(canSendGroupChat({ chatEnabled: true, chatUsersCanSend: false, hasSendPermission: true, canModerate: false })).toBe(false);
    expect(canSendGroupChat({ chatEnabled: true, chatUsersCanSend: false, hasSendPermission: true, canModerate: true })).toBe(true);
    expect(canSendGroupChat({ chatEnabled: true, chatUsersCanSend: true, hasSendPermission: true, canModerate: false })).toBe(true);
  });
});
