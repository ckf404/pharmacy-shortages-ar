import { describe, expect, it } from "vitest";
import { canDeleteChatMessage, canReactToChatMessage, canSendGroupChat, chatReactionToggleAction, hasAvailableChatReferences, messageIdsReadOnChatOpen, normalizeChatMessage, toggleChatReactionInStore } from "./chatDomain";

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
    expect(canSendGroupChat({ chatEnabled: false, chatUsersCanSend: true, canModerate: false })).toBe(false);
    expect(canSendGroupChat({ chatEnabled: true, chatUsersCanSend: false, canModerate: false })).toBe(false);
    expect(canSendGroupChat({ chatEnabled: true, chatUsersCanSend: false, canModerate: true })).toBe(true);
    expect(canSendGroupChat({ chatEnabled: true, chatUsersCanSend: true, canModerate: false })).toBe(true);
  });

  it("records the distinct visible messages when a chat is opened", () => {
    expect(messageIdsReadOnChatOpen([4, 4, 7, -1, 0])).toEqual([4, 7]);
  });

  it("toggles reactions safely and rejects deleted chat messages", () => {
    expect(chatReactionToggleAction(false)).toBe("add");
    expect(chatReactionToggleAction(true)).toBe("remove");
    expect(canReactToChatMessage({ id: 7, deletedAt: null })).toBe(true);
    expect(canReactToChatMessage({ id: 7, deletedAt: new Date() })).toBe(false);
  });

  it("adds then removes a stored reaction and rejects a deleted message at the storage boundary", async () => {
    const reactions: { id: number; messageId: number; userId: number; emoji: string }[] = [];
    const store = {
      findMessage: async (messageId: number) => messageId === 99 ? { id: 99, deletedAt: new Date() } : { id: messageId, deletedAt: null },
      findReaction: async (input: { messageId: number; userId: number; emoji: string }) => reactions.find(reaction => reaction.messageId === input.messageId && reaction.userId === input.userId && reaction.emoji === input.emoji),
      addReaction: async (input: { messageId: number; userId: number; emoji: string }) => { reactions.push({ id: 1, ...input }); },
      removeReaction: async (reactionId: number) => { const index = reactions.findIndex(reaction => reaction.id === reactionId); if (index >= 0) reactions.splice(index, 1); },
    };
    await expect(toggleChatReactionInStore({ messageId: 7, userId: 3, emoji: "🔥" }, store)).resolves.toBe(true);
    expect(reactions).toHaveLength(1);
    await expect(toggleChatReactionInStore({ messageId: 7, userId: 3, emoji: "🔥" }, store)).resolves.toBe(false);
    expect(reactions).toHaveLength(0);
    await expect(toggleChatReactionInStore({ messageId: 99, userId: 3, emoji: "🔥" }, store)).rejects.toThrow("الرسالة غير موجودة");
  });

  it("requires every reply or forward reference to remain available", () => {
    expect(hasAvailableChatReferences([4, 7], [7, 4])).toBe(true);
    expect(hasAvailableChatReferences([4, 7], [4])).toBe(false);
  });
});
