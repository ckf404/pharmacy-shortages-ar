import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { hasPermission } from "@/lib/permissions";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Check, CheckCheck, Eye, Forward, Loader2, MessageCircleMore, Reply, Send, ShieldCheck, Trash2, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const reactionChoices = ["👍", "❤️", "😂", "🙏", "🔥"] as const;

export default function TeamChat() {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<any | null>(null);
  const [viewingReadersFor, setViewingReadersFor] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const presentation = trpc.presentation.get.useQuery();
  const messages = trpc.chat.messages.useQuery(undefined, { enabled: Boolean(user && presentation.data?.chatEnabled !== false) });
  const canModerate = hasPermission(user, "chat_manage");
  const canSend = presentation.data?.chatUsersCanSend !== false || canModerate;
  const send = trpc.chat.send.useMutation({ onSuccess: async () => { setBody(""); setReplyingTo(null); setForwardingMessage(null); await utils.chat.messages.invalidate(); } });
  const remove = trpc.chat.delete.useMutation({ onSuccess: () => utils.chat.messages.invalidate() });
  const react = trpc.chat.react.useMutation({ onSuccess: () => utils.chat.messages.invalidate() });
  const markRead = trpc.chat.read.useMutation();
  const ordered = useMemo(() => [...(messages.data ?? [])].reverse(), [messages.data]);

  useEffect(() => {
    const ids = messages.data?.map(message => message.id) ?? [];
    if (ids.length) markRead.mutate({ messageIds: ids });
  }, [messages.data]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    try {
      await send.mutateAsync({ body, replyToMessageId: replyingTo?.id ?? null, forwardedFromMessageId: forwardingMessage?.id ?? null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إرسال الرسالة.");
    }
  };

  const reply = (message: any) => {
    setForwardingMessage(null);
    setReplyingTo(message);
  };

  const forward = (message: any) => {
    setReplyingTo(null);
    setForwardingMessage(message);
    setBody(message.body);
  };

  const cancelContext = () => {
    setReplyingTo(null);
    setForwardingMessage(null);
  };

  if (presentation.data?.chatEnabled === false) return <section className="panel text-center"><MessageCircleMore className="mx-auto h-9 w-9 text-slate-400" /><h1 className="mt-3 text-xl font-bold text-slate-800">الدردشة متوقفة حاليًا</h1><p className="mt-2 text-sm text-slate-500">يمكن للمشرف تشغيلها من تحكم المشرف عند الحاجة.</p></section>;

  return <div className="team-chat-page space-y-5"><header className="team-chat-hero"><div className="team-chat-hero-icon"><UsersRound className="h-6 w-6" /></div><div><p>تواصل داخلي سريع</p><h1>{presentation.data?.chatTitle ?? "دردشة الفريق"}</h1><span>{presentation.data?.chatDescription ?? "تواصل سريع بين فريق الصيدلية."}</span></div><div className="team-chat-live"><i />يتحدث تلقائيًا</div></header><section className="team-chat-shell"><div className="team-chat-stream">{messages.isLoading ? <div className="page-loader py-12"><Loader2 className="h-5 w-5 animate-spin" />جاري تحميل الدردشة…</div> : ordered.length ? ordered.map(message => {
    const own = message.createdByUserId === user?.id;
    const otherReaders = message.readers.filter(reader => reader.userId !== user?.id);
    const readerPanelOpen = viewingReadersFor === message.id;
    return <article key={message.id} className={`team-chat-message ${own ? "team-chat-own" : ""}`}><div className="team-chat-avatar">{message.authorName.slice(0, 1)}</div><div className="team-chat-message-main"><div className="team-chat-bubble">{message.forwardedFrom && <div className="team-chat-forwarded"><Forward className="h-3 w-3" />تم تحويل رسالة من {message.forwardedFrom.authorName}</div>}{message.replyTo && <div className="team-chat-quote"><Reply className="h-3 w-3" /><span><b>{message.replyTo.authorName}</b>{message.replyTo.body}</span></div>}<div className="team-chat-meta"><strong>{own ? "أنت" : message.authorName}</strong><span>{message.authorRole === "admin" ? "مدير" : message.authorRole === "supervisor" ? "مشرف" : "فريق"} · {new Date(message.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span></div><p>{message.body}</p>{message.reactions.length > 0 && <div className="team-chat-reaction-summary">{message.reactions.map(reaction => <button type="button" key={reaction.emoji} className={reaction.reactedByMe ? "team-chat-reaction-active" : ""} title={reaction.names.join("، ")} onClick={() => react.mutate({ messageId: message.id, emoji: reaction.emoji as typeof reactionChoices[number] })}>{reaction.emoji} <span>{reaction.count}</span></button>)}</div>}</div><div className="team-chat-message-actions"><div className="team-chat-reaction-picker">{reactionChoices.map(emoji => <button type="button" key={emoji} onClick={() => react.mutate({ messageId: message.id, emoji })} aria-label={`تفاعل ${emoji}`}>{emoji}</button>)}</div><Button variant="ghost" size="icon" onClick={() => reply(message)} title="رد" aria-label="رد على الرسالة"><Reply className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" onClick={() => forward(message)} title="تحويل" aria-label="تحويل الرسالة"><Forward className="h-3.5 w-3.5" /></Button>{(own || canModerate) && <Button variant="ghost" size="icon" className="team-chat-delete" onClick={() => remove.mutate({ id: message.id })} title="حذف الرسالة" aria-label="حذف الرسالة"><Trash2 className="h-3.5 w-3.5" /></Button>}</div>{own && <button type="button" className="team-chat-read-status" onClick={() => setViewingReadersFor(readerPanelOpen ? null : message.id)} title="من شاهد الرسالة">{otherReaders.length ? <CheckCheck className="h-4 w-4" /> : <Check className="h-4 w-4" />}<span>{otherReaders.length ? "شوهد" : "أُرسل"}</span></button>}{own && readerPanelOpen && <div className="team-chat-readers"><Eye className="h-3.5 w-3.5" /><span>{otherReaders.length ? `شاهدها: ${otherReaders.map(reader => reader.name).join("، ")}` : "لم يشاهدها أحد من الفريق بعد."}</span></div>}</div></article>;
  }) : <div className="team-chat-empty"><MessageCircleMore className="h-8 w-8" /><p>ابدأ أول رسالة للفريق.</p></div>}</div><form className="team-chat-compose" onSubmit={submit}>{(replyingTo || forwardingMessage) && <div className="team-chat-compose-context"><div>{replyingTo ? <Reply className="h-4 w-4" /> : <Forward className="h-4 w-4" />}<span>{replyingTo ? `رد على ${replyingTo.authorName}` : `تحويل رسالة من ${forwardingMessage.authorName}`}</span><small>{(replyingTo ?? forwardingMessage).body}</small></div><Button type="button" variant="ghost" size="icon" onClick={cancelContext} aria-label="إلغاء"><X className="h-4 w-4" /></Button></div>}<Textarea value={body} onChange={event => setBody(event.target.value)} placeholder={canSend ? "اكتب رسالة للفريق…" : "المشرف أوقف الإرسال للحسابات العادية مؤقتًا."} disabled={!canSend || send.isPending} maxLength={1200} /><div><span><ShieldCheck className="h-3.5 w-3.5" />رسائل داخل التطبيق فقط</span><Button type="submit" disabled={!canSend || !body.trim() || send.isPending}>{send.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}إرسال</Button></div></form></section></div>;
}
