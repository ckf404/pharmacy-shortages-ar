import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Building2, KeyRound, Loader2, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type LoginMode = "user" | "manager";

export default function Login() {
  const [mode, setMode] = useState<LoginMode>("manager");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const accounts = trpc.auth.loginAccounts.useQuery({ mode });
  const login = trpc.auth.login.useMutation({
    onSuccess: user => {
      utils.auth.me.setData(undefined, user as any);
      void utils.auth.me.invalidate();
    },
  });

  useEffect(() => setUsername(""), [mode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username) return;
    await login.mutateAsync({ mode, username, password });
  };

  return (
    <main className="login-shell min-h-screen overflow-hidden px-4 py-8 sm:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <section className="hidden min-w-0 text-white lg:block">
          <div className="mb-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15"><Stethoscope className="h-7 w-7" /></div>
          <p className="mb-4 text-sm font-semibold tracking-[.25em] text-emerald-200">نواقص الصيدلية</p>
          <h1 className="max-w-xl text-3xl font-bold leading-[1.65] xl:text-4xl">كل نقص، وكل مخزن، في قائمة يومية واضحة.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-200">سجّل الدواء الناقص، حدّد أهميته، علِّم عليه عند وصوله، وجهّز طلبًا منظمًا للمخزن عبر واتساب للمراجعة والإرسال منك.</p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3 text-center text-xs text-slate-200">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="mx-auto mb-2 h-5 w-5 text-emerald-200" />صلاحيات واضحة</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4"><Building2 className="mx-auto mb-2 h-5 w-5 text-emerald-200" />مخازن منظمة</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4"><KeyRound className="mx-auto mb-2 h-5 w-5 text-emerald-200" />دخول محلي آمن</div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md min-w-0 rounded-[1.75rem] border border-white/60 bg-white/95 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur sm:p-8">
          <div className="mb-8 text-center lg:text-right">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 lg:hidden"><Stethoscope className="h-6 w-6" /></div>
            <p className="text-sm font-bold text-teal-700">نواقص الصيدلية</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">تسجيل الدخول</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">اختر نوع الحساب ثم اسم المستخدم من القائمة.</p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="نوع الدخول">
            <button type="button" onClick={() => setMode("user")} className={cn("rounded-lg px-3 py-2.5 text-sm font-semibold transition", mode === "user" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500")}>
              <UserRound className="ml-1 inline h-4 w-4" />دخول مستخدم
            </button>
            <button type="button" onClick={() => setMode("manager")} className={cn("rounded-lg px-3 py-2.5 text-sm font-semibold transition", mode === "manager" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500")}>
              <ShieldCheck className="ml-1 inline h-4 w-4" />دخول مشرف
            </button>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="account">الحساب</Label>
              <Select value={username} onValueChange={setUsername} disabled={accounts.isLoading || (accounts.data?.length ?? 0) === 0}>
                <SelectTrigger id="account" className="h-12 bg-white"><SelectValue placeholder={accounts.isLoading ? "جاري تحميل الحسابات…" : "اختر اسم المستخدم"} /></SelectTrigger>
                <SelectContent>
                  {accounts.data?.map(account => <SelectItem value={account.username} key={account.id}>{account.name} — {account.username}</SelectItem>)}
                </SelectContent>
              </Select>
              {!accounts.isLoading && accounts.data?.length === 0 && <p className="text-xs text-amber-700">لا توجد حسابات مفعلة لهذا النوع بعد.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="h-12 bg-white" placeholder="أدخل كلمة المرور" required />
            </div>
            {login.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{login.error.message}</p>}
            <Button className="h-12 w-full bg-teal-700 text-base hover:bg-teal-800" disabled={!username || login.isPending}>
              {login.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <KeyRound className="ml-2 h-4 w-4" />}دخول آمن
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
