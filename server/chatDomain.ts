export const CHAT_MESSAGE_MAX_LENGTH = 1200;

export function normalizeChatMessage(raw: string) {
  return raw.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export function canDeleteChatMessage(input: { authorUserId: number; actorUserId: number; canModerate: boolean }) {
  return input.authorUserId === input.actorUserId || input.canModerate;
}

export function canSendGroupChat(input: { chatEnabled: boolean; chatUsersCanSend: boolean; canModerate: boolean }) {
  return input.chatEnabled && (input.chatUsersCanSend || input.canModerate);
}

export function messageIdsReadOnChatOpen(messageIds: number[]) {
  return Array.from(new Set(messageIds.filter(id => Number.isInteger(id) && id > 0))).slice(0, 120);
}

export function chatReactionToggleAction(hasExistingReaction: boolean) {
  return hasExistingReaction ? "remove" : "add";
}

export function canReactToChatMessage(message: { id: number; deletedAt: Date | null } | null | undefined) {
  return Boolean(message && !message.deletedAt);
}

export function hasAvailableChatReferences(requestedIds: number[], foundIds: number[]) {
  return requestedIds.length === foundIds.length && requestedIds.every(id => foundIds.includes(id));
}

export type ChatReactionStore = {
  findMessage: (messageId: number) => Promise<{ id: number; deletedAt: Date | null } | undefined>;
  findReaction: (input: { messageId: number; userId: number; emoji: string }) => Promise<{ id: number } | undefined>;
  addReaction: (input: { messageId: number; userId: number; emoji: string }) => Promise<void>;
  removeReaction: (reactionId: number) => Promise<void>;
};

export async function toggleChatReactionInStore(input: { messageId: number; userId: number; emoji: string }, store: ChatReactionStore) {
  const message = await store.findMessage(input.messageId);
  if (!canReactToChatMessage(message)) throw new Error("الرسالة غير موجودة");
  const existing = await store.findReaction(input);
  if (chatReactionToggleAction(Boolean(existing)) === "remove" && existing) {
    await store.removeReaction(existing.id);
    return false;
  }
  await store.addReaction(input);
  return true;
}
