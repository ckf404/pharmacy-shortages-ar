export const CHAT_MESSAGE_MAX_LENGTH = 1200;

export function normalizeChatMessage(raw: string) {
  return raw.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export function canDeleteChatMessage(input: { authorUserId: number; actorUserId: number; canModerate: boolean }) {
  return input.authorUserId === input.actorUserId || input.canModerate;
}

export function canSendGroupChat(input: { chatEnabled: boolean; chatUsersCanSend: boolean; hasSendPermission: boolean; canModerate: boolean }) {
  return input.chatEnabled && input.hasSendPermission && (input.chatUsersCanSend || input.canModerate);
}
