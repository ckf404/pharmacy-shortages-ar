import { useEffect, useMemo, useState } from "react";
import { Award, ClipboardList, Crown, Gem, KeyRound, Loader2, Medal, PackageCheck, Save, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

const roleLabel = { admin: "مدير النظام", supervisor: "مشرف كامل", user: "عضو الفريق" } as const;
const tierNames = ["بداية موفقة", "متابع نشط", "خبير النواقص", "قائد التوريد", "نجم الصيدلية"];

export default function Profile() {
  const utils = trpc.useUtils();
  const profile = trpc.profile.me.useQuery();
  const leaderboard = trpc.profile.leaderboard.useQuery();
  const [form, setForm] = useState({ name: "", username: "", currentPassword: "", newPassword: "" });
  useEffect(() => { if (profile.data) setForm(current => ({ ...current, name: profile.data.user.name, username: profile.data.user.username })); }, [profile.data]);
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: async () => { await Promise.all([utils.profile.me.invalidate(), utils.profile.leaderboard.invalidate(), utils.auth.me.invalidate()]); setForm(current => ({ ...current, currentPassword: "", newPassword: "" })); toast.success("تم حفظ بيانات حسابك."); },
    onError: error => toast.error(error.message),
  });
  const progress = useMemo(() => {
    const stats = profile.data?.stats;
    if (!stats || !stats.nextLevelAt) return 100;
    const currentStart = stats.level === 1 ? 0 : [0, 15, 45, 90, 160][stats.level - 1] ?? 0;
    return Math.min(100, Math.max(0, ((stats.points - currentStart) / (stats.nextLevelAt - currentStart)) * 100));
  }, [profile.data]);
  if (profile.isLoading) return <div className="page-loader"><Loader2 className="h-6 w-6 animate-spin" />جاري فتح نادي الإنجازات…</div>;
  if (!profile.data) return <div className="empty-note">تعذر تحميل بيانات الحساب الآن.</div>;

  const { user, stats } = profile.data;
  const events = [
    { title: "تحدي التسجيل", caption: "سجّل 5 نواقص بدقة", icon: ClipboardList, value: stats.added, target: 5, color: "sky" },
    { title: "سرعة الاستلام", caption: "أكّد وصول 5 أصناف", icon: PackageCheck, value: stats.received, target: 5, color: "emerald" },
    { title: "قائد التوريد", caption: "جهّز 3 طلبات للمخازن", icon: Zap, value: stats.orders, target: 3, color: "violet" },
  ];
  const nextEvent = events.find(event => event.value < event.target) ?? events[0];
  const nextEventRemaining = Math.max(0, nextEvent.target - nextEvent.value);
  const podium = leaderboard.data?.slice(0, 3) ?? [];
  const myRank = leaderboard.data?.findIndex(entry => entry.id === user.id);

  return <div className="space-y-6">
    <header><p className="eyebrow">VIP · نادي الإنجازات</p><h1 className="page-title">مسارك نحو القمة</h1><p className="mt-1 text-sm text-slate-500">كل مستوى ونقطة هنا محسوبان من تسجيلك الفعلي للنواقص والاستلام وتجهيز الطلبات.</p></header>
    <section className="vip-hero">
      <div className="vip-glow vip-glow-one" /><div className="vip-glow vip-glow-two" />
      <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-end"><div><div className="vip-kicker"><Crown className="h-4 w-4" />عضوية {roleLabel[user.role]}</div><h2>{stats.levelName}</h2><p className="mt-2 max-w-xl text-sm text-slate-200">المستوى {stats.level} من {tierNames.length} · رتبتك الحالية {myRank !== undefined && myRank >= 0 ? `#${myRank + 1}` : "قيد الحساب"} بين الفريق.</p><div className="mt-7"><div className="flex justify-between text-xs text-slate-200"><span>{stats.nextLevelAt ? `باقي ${Math.max(0, stats.nextLevelAt - stats.points)} نقطة للمستوى التالي` : "وصلت إلى أعلى مستوى"}</span><strong>{stats.points} نقطة</strong></div><div className="vip-progress"><span style={{ width: `${progress}%` }} /></div></div></div><div className="vip-medallion"><Gem className="h-10 w-10" /><strong>LVL {stats.level}</strong><span>{stats.nextLevelAt ? `${Math.round(progress)}%` : "MAX"}</span></div></div>
    </section>
    <section className="grid gap-4 md:grid-cols-3">{[{ label: "نقص مسجل", value: stats.added, icon: ClipboardList }, { label: "صنف مستلم", value: stats.received, icon: PackageCheck }, { label: "طلب مُجهز", value: stats.orders, icon: Target }].map(metric => <article key={metric.label} className="vip-metric"><span><metric.icon className="h-5 w-5" /></span><div><strong>{metric.value}</strong><p>{metric.label}</p></div></article>)}</section>
    <section className="vip-next-action"><div className="vip-next-action-icon"><nextEvent.icon className="h-5 w-5" /></div><div><p>خطوتك التحفيزية التالية</p><h2>{nextEventRemaining ? `${nextEvent.title}: متبقي ${nextEventRemaining}` : `${nextEvent.title}: مكتملة — حافظ على تقدمك`}</h2><span>{nextEvent.caption} · هذا الهدف يستند إلى سجل عملك الفعلي فقط.</span></div><Sparkles className="vip-next-action-sparkle h-5 w-5" /></section>
    <section className="panel vip-events"><div className="panel-heading"><span className="icon-surface bg-amber-50 text-amber-700"><Sparkles className="h-5 w-5" /></span><div><h2>فعاليات الفريق</h2><p>أكمل المهمة لتقوية رصيدك وموقعك في لوحة القمة.</p></div></div><div className="mt-5 grid gap-3 lg:grid-cols-3">{events.map(event => { const percent = Math.min(100, event.value / event.target * 100); return <article key={event.title} className={`vip-event vip-event-${event.color}`}><span className="vip-event-icon"><event.icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3>{event.title}</h3><strong>{Math.min(event.value, event.target)}/{event.target}</strong></div><p>{event.caption}</p><div className="vip-event-progress"><span style={{ width: `${percent}%` }} /></div>{percent >= 100 && <small>مكتملة · ممتاز</small>}</div></article>; })}</div></section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,.72fr)]"><article className="panel"><div className="panel-heading"><span className="icon-surface bg-amber-50 text-amber-700"><Trophy className="h-5 w-5" /></span><div><h2>منصة القمة</h2><p>ترتيب مباشر بحسب نقاط العمل الفعلية.</p></div></div>{podium.length > 0 && <div className="vip-podium mt-7">{podium.map((entry, index) => <div key={entry.id} className={`vip-podium-card vip-place-${index + 1} ${entry.id === user.id ? "vip-podium-self" : ""}`}><span className="vip-place"><Medal className="h-5 w-5" />#{index + 1}</span><strong className="truncate">{entry.name}</strong><p>{entry.levelName}</p><b>{entry.points} نقطة</b></div>)}</div>}<div className="mt-5 space-y-2">{leaderboard.data?.slice(3).map((entry, index) => <div key={entry.id} className={`leaderboard-row ${entry.id === user.id ? "leaderboard-row-self" : ""}`}><span className="leaderboard-rank">{index + 4}</span><div className="min-w-0 flex-1"><p className="truncate font-bold text-slate-800">{entry.name}{entry.id === user.id && <span className="mr-2 text-xs font-semibold text-teal-700">أنت</span>}</p><p className="mt-0.5 text-xs text-slate-500">{entry.orders} طلبات · {entry.received} مستلم</p></div><strong className="text-sm text-teal-800">{entry.points}</strong></div>)}</div></article>
      <article className="panel overflow-visible"><div className="panel-heading"><span className="icon-surface"><Award className="h-5 w-5" /></span><div><h2>بطاقة الحساب</h2><p>{roleLabel[user.role]}</p></div></div><form className="mt-6 grid gap-4" onSubmit={event => { event.preventDefault(); if (form.newPassword && !form.currentPassword) return toast.error("اكتب كلمة المرور الحالية قبل اختيار كلمة جديدة."); updateProfile.mutate({ name: form.name, username: form.username, currentPassword: form.currentPassword || undefined, newPassword: form.newPassword || undefined }); }}><div className="space-y-2"><Label htmlFor="profile-name">الاسم الظاهر</Label><Input id="profile-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></div><div className="space-y-2"><Label htmlFor="profile-username">اسم المستخدم</Label><Input id="profile-username" dir="ltr" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} required /></div><div className="space-y-2"><Label htmlFor="current-password">كلمة المرور الحالية</Label><Input id="current-password" type="password" dir="ltr" value={form.currentPassword} onChange={event => setForm({ ...form, currentPassword: event.target.value })} autoComplete="current-password" /></div><div className="space-y-2"><Label htmlFor="new-password">كلمة المرور الجديدة</Label><Input id="new-password" type="password" dir="ltr" value={form.newPassword} onChange={event => setForm({ ...form, newPassword: event.target.value })} autoComplete="new-password" minLength={4} /></div><Button type="submit" className="h-11 bg-teal-700 hover:bg-teal-800" disabled={updateProfile.isPending}>{updateProfile.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}حفظ بيانات الحساب</Button></form></article></section>
  </div>;
}
