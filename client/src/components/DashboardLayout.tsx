import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Building2, ClipboardList, LogOut, Menu, Settings2, ShieldCheck, Stethoscope, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const navigation = [
  { path: "/", label: "نواقص اليوم", icon: ClipboardList, minimum: "user" },
  { path: "/suppliers", label: "المخازن", icon: Building2, minimum: "supervisor" },
  { path: "/users", label: "المستخدمون", icon: UsersRound, minimum: "admin" },
  { path: "/settings", label: "الإعدادات", icon: Settings2, minimum: "supervisor" },
] as const;

const roles = { user: 1, supervisor: 2, admin: 3 };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const allowed = navigation.filter(item => user && roles[user.role] >= roles[item.minimum]);
  return <div className="min-h-screen bg-[#f6f9f8]">
    <aside className={cn("app-sidebar", mobileOpen && "app-sidebar-open")}>
      <div className="flex items-center justify-between px-5 pt-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300"><Stethoscope className="h-5 w-5" /></span><div><p className="text-sm font-bold text-white">نواقص الصيدلية</p><p className="mt-0.5 text-xs text-slate-400">متابعة يومية دقيقة</p></div></div><button className="text-slate-300 lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button></div>
      <nav className="mt-10 space-y-1 px-3">{allowed.map(item => <button key={item.path} onClick={() => { setLocation(item.path); setMobileOpen(false); }} className={cn("nav-link", location === item.path && "nav-link-active")}><item.icon className="h-4 w-4" />{item.label}</button>)}</nav>
      <div className="mt-auto border-t border-white/10 p-4"><div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">{user?.name?.slice(0, 1)}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{user?.name}</p><p className="truncate text-xs text-slate-400">{user?.role === "admin" ? "مدير النظام" : user?.role === "supervisor" ? "مشرف" : "مستخدم"}</p></div></div><button onClick={logout} className="nav-link w-full text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"><LogOut className="h-4 w-4" />تسجيل الخروج</button></div>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" />}
    <div className="lg:pr-72"><header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur sm:px-7"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button><div className="mr-auto flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-teal-700" />جلسة محلية آمنة</div></header><main className="mx-auto max-w-7xl p-4 sm:p-7">{children}</main></div>
  </div>;
}
