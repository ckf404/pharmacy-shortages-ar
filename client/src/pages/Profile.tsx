import { useEffect, useMemo, useState } from "react";
import { Award, ClipboardList, KeyRound, Loader2, PackageCheck, Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

const roleLabel = { admin: "مدير النظام", supervisor: "مشرف", user: "مستخدم" } as const;

export default function Profile() {
  const utils = trpc.useUtils();
  const profile = trpc.profile.me.useQuery();
  const leaderboard = trpc.profile.leaderboard.useQuery();
  const [form, setForm] = useState({ name: "", username: "", currentPassword: "", newPassword: "" });

  useEffect(() => {
    if (profile.data) setForm(current => ({ ...current, name: profile.data.user.name, username: profile.data.user.username }));
  }, [profile.data]);

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.profile.me.invalidate(), utils.profile.leaderboard.invalidate(), utils.auth.me.invalidate()]);
      setForm(current => ({ ...current, currentPassword: "", newPassword: "" }));
      toast.success("تم حفظ بيانات حسابك.");
    },
    onError: error => toast.error(error.message),
  });

  const progress = useMemo(() => {
    const stats = profile.data?.stats;
    if (!stats || !stats.nextLevelAt) return 100;
    const currentStart = stats.level === 1 ? 0 : [0, 15, 45, 90, 160][stats.level - 1] ?? 0;
    return Math.min(100, Math.max(0, ((stats.points - currentStart) / (stats.nextLevelAt - currentStart)) * 100));
  }, [profile.data]);

  if (profile.isLoading) return <div className="page-loader"><Loader2 className="h-6 w-6 animate-spin" />جاري فتح ملفك الشخصي…</div>;
  if (!profile.data) return <div className="empty-note">تعذر تحميل بيانات الحساب الآن.</div>;

  const { user, stats } = profile.data;
  return <div className="space-y-6">
    <header><p className="eyebrow">حسابك وإنجازاتك</p><h1 className="page-title">الملف الشخصي</h1><p className="mt-1 text-sm text-slate-500">عدّل بيانات الدخول بنفسك، وتابع مساهمتك الفعلية في عمل النواقص والطلبات.</p></header>

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.72fr)]">
      <article className="panel overflow-visible">
        <div className="panel-heading"><span className="icon-surface"><Award className="h-5 w-5" /></span><div><h2>بيانات الحساب</h2><p>دورك الحالي: {roleLabel[user.role]}</p></div></div>
        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={event => {
          event.preventDefault();
          if (form.newPassword && !form.currentPassword) return toast.error("اكتب كلمة المرور الحالية قبل اختيار كلمة جديدة.");
          updateProfile.mutate({ name: form.name, username: form.username, currentPassword: form.currentPassword || undefined, newPassword: form.newPassword || undefined });
        }}>
          <div className="space-y-2"><Label htmlFor="profile-name">الاسم الظاهر</Label><Input id="profile-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="profile-username">اسم المستخدم</Label><Input id="profile-username" dir="ltr" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="current-password">كلمة المرور الحالية <span className="text-slate-400">عند تغييرها فقط</span></Label><Input id="current-password" type="password" dir="ltr" value={form.currentPassword} onChange={event => setForm({ ...form, currentPassword: event.target.value })} autoComplete="current-password" /></div>
          <div className="space-y-2"><Label htmlFor="new-password">كلمة المرور الجديدة <span className="text-slate-400">4 أحرف أو أكثر</span></Label><Input id="new-password" type="password" dir="ltr" value={form.newPassword} onChange={event => setForm({ ...form, newPassword: event.target.value })} autoComplete="new-password" minLength={4} /></div>
          <div className="sm:col-span-2"><Button type="submit" className="h-11 bg-teal-700 hover:bg-teal-800" disabled={updateProfile.isPending}>{updateProfile.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}حفظ بيانات الحساب</Button></div>
        </form>
      </article>

      <article className="achievement-card">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-teal-100">مستوى حسابك</p><h2 className="mt-1 text-2xl font-bold text-white">{stats.levelName}</h2><p className="mt-2 text-sm text-teal-100">المستوى {stats.level} · {stats.points} نقطة</p></div><span className="achievement-trophy"><Trophy className="h-6 w-6" /></span></div>
        <div className="mt-6"><div className="flex justify-between text-xs text-teal-100"><span>{stats.nextLevelAt ? `متبقي ${Math.max(0, stats.nextLevelAt - stats.points)} نقطة` : "وصلت لأعلى مستوى"}</span><span>{stats.nextLevelAt ?? "مكتمل"}</span></div><div className="achievement-progress"><span style={{ width: `${progress}%` }} /></div></div>
        <div className="mt-6 grid grid-cols-3 gap-2 text-center"><div><ClipboardList className="mx-auto h-4 w-4 text-teal-200" /><strong>{stats.added}</strong><span>نقص مسجل</span></div><div><PackageCheck className="mx-auto h-4 w-4 text-teal-200" /><strong>{stats.received}</strong><span>صنف مستلم</span></div><div><KeyRound className="mx-auto h-4 w-4 text-teal-200" /><strong>{stats.orders}</strong><span>طلب مُجهز</span></div></div>
      </article>
    </section>

    <section className="panel"><div className="panel-heading"><span className="icon-surface bg-amber-50 text-amber-700"><Trophy className="h-5 w-5" /></span><div><h2>لوحة الإنجاز</h2><p>الترتيب مبني على السجل التشغيلي المشترك: تسجيل النواقص والاستلام وتجهيز الطلبات.</p></div></div><div className="mt-5 space-y-2">{leaderboard.data?.map((entry, index) => <div key={entry.id} className={`leaderboard-row ${entry.id === user.id ? "leaderboard-row-self" : ""}`}><span className="leaderboard-rank">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-bold text-slate-800">{entry.name}{entry.id === user.id && <span className="mr-2 text-xs font-semibold text-teal-700">أنت</span>}</p><p className="mt-0.5 text-xs text-slate-500">{entry.levelName} · {entry.orders} طلبات · {entry.received} مستلم</p></div><strong className="text-sm text-teal-800">{entry.points} نقطة</strong></div>)}{!leaderboard.isLoading && leaderboard.data?.length === 0 && <p className="empty-note">ستظهر لوحة الإنجاز عند وجود حسابات نشطة.</p>}</div></section>
  </div>;
}
