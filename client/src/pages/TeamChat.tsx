import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { hasPermission } from "@/lib/permissions";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, MessageCircleMore, Send, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function TeamChat() {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const utils = trpc.useUtils();
  const presentation = trpc.presentation.get.useQuery();
  const messages = trpc.chat.messages.useQuery(undefined, { enabled: Boolean(user && presentation.data?.chatEnabled !== false) });
  const canSend = hasPermission(user, "chat_send") && (presentation.data?.chatUsersCanSend !== false || hasPermission(user, "chat_manage"));
  const canModerate = hasPermission(user, "chat_manage");
  const send = trpc.chat.send.useMutation({ onSuccess: async () => { setBody(""); await utils.chat.messages.invalidate(); } });
  const remove = trpc.chat.delete.useMutation({ onSuccess: () => utils.chat.messages.invalidate() });
  const ordered = useMemo(() => [...(messages.data ?? [])].reverse(), [messages.data]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    try { await send.mutateAsync({ body }); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إرسال الرسالة."); }
  };
  if (presentation.data?.chatEnabled === false) return <section className="panel text-center"><MessageCircleMore className="mx-auto h-9 w-9 text-slate-400" /><h1 className="mt-3 text-xl font-bold text-slate-800">الدردشة متوقفة حاليًا</h1><p className="mt-2 text-sm text-slate-500">يمكن للمشرف تشغيلها من تحكم المشرف عند الحاجة.</p></section>;
  return <div className="team-chat-page space-y-5"><header className="team-chat-hero"><div className="team-chat-hero-icon"><UsersRound className="h-6 w-6" /></div><div><p>تواصل داخلي سريع</p><h1>{presentation.data?.chatTitle ?? "دردشة الفريق"}</h1><span>{presentation.data?.chatDescription ?? "تواصل سريع بين فريق الصيدلية."}</span></div><div className="team-chat-live"><i />يتحدث تلقائيًا</div></header><section className="team-chat-shell"><div className="team-chat-stream">{messages.isLoading ? <div className="page-loader py-12"><Loader2 className="h-5 w-5 animate-spin" />جاري تحميل الدردشة…</div> : ordered.length ? ordered.map(message => { const own = message.createdByUserId === user?.id; return <article key={message.id} className={`team-chat-message ${own ? "team-chat-own" : ""}`}><div className="team-chat-avatar">{message.authorName.slice(0, 1)}</div><div className="team-chat-bubble"><div className="team-chat-meta"><strong>{own ? "أنت" : message.authorName}</strong><span>{message.authorRole === "admin" ? "مدير" : message.authorRole === "supervisor" ? "مشرف" : "فريق"} · {new Date(message.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span></div><p>{message.body}</p></div>{(own || canModerate) && <Button variant="ghost" size="icon" className="team-chat-delete" onClick={() => remove.mutate({ id: message.id })} title="حذف الرسالة" aria-label="حذف الرسالة"><Trash2 className="h-4 w-4" /></Button>}</article>; }) : <div className="team-chat-empty"><MessageCircleMore className="h-8 w-8" /><p>ابدأ أول رسالة للفريق.</p></div>}</div><form className="team-chat-compose" onSubmit={submit}><Textarea value={body} onChange={event => setBody(event.target.value)} placeholder={canSend ? "اكتب رسالة للفريق…" : "المشرف أوقف الإرسال للحسابات العادية مؤقتًا."} disabled={!canSend || send.isPending} maxLength={1200} /><div><span><ShieldCheck className="h-3.5 w-3.5" />رسائل داخل التطبيق فقط</span><Button type="submit" disabled={!canSend || !body.trim() || send.isPending}>{send.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}إرسال</Button></div></form></section></div>;
}
