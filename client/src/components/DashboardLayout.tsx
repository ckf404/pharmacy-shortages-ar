import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { Bell, Building2, CheckCheck, ClipboardList, LogOut, Menu, MessageCircleMore, Settings2, ShieldCheck, SlidersHorizontal, Stethoscope, Trophy, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

type NavigationItem = { key: string; path: string; label: string; icon: typeof ClipboardList; permissions?: PermissionKey[] };

const navigation: NavigationItem[] = [
  { key: "shortages", path: "/", label: "نواقص اليوم", icon: ClipboardList },
  { key: "profile", path: "/profile", label: "حسابي وإنجازاتي", icon: Trophy },
  { key: "chat", path: "/chat", label: "دردشة الفريق", icon: MessageCircleMore },
  { key: "suppliers", path: "/suppliers", label: "المخازن", icon: Building2, permissions: ["suppliers_manage"] },
  { key: "users", path: "/users", label: "المستخدمون", icon: UsersRound, permissions: ["users_manage"] },
  { key: "control", path: "/settings/control", label: "تحكم المشرف", icon: SlidersHorizontal, permissions: ["settings_manage"] },
  { key: "settings", path: "/settings/control", label: "مركز التحكم", icon: Settings2, permissions: ["messages_manage", "settings_manage", "rollover_manage", "activity_view"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const { user, logout } = useAuth();
  const presentation = trpc.presentation.get.useQuery();
  const inbox = trpc.messages.inbox.useQuery(undefined, { enabled: !!user });
  const readMessage = trpc.messages.read.useMutation({ onSuccess: () => inbox.refetch() });
  const desiredOrder = presentation.data?.navigationOrder?.split(",").map(item => item.trim()).filter(Boolean) ?? [];
  const visibleKeys = presentation.data?.visibleNavigation?.split(",").map(item => item.trim()).filter(Boolean) ?? navigation.map(item => item.key);
  const allowed = navigation.filter(item => user && (item.key === "settings" || visibleKeys.includes(item.key)) && (!item.permissions || item.permissions.some(permission => hasPermission(user, permission)))).sort((a, b) => {
    const aIndex = desiredOrder.indexOf(a.key); const bIndex = desiredOrder.indexOf(b.key);
    return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
  });
  const unread = inbox.data?.filter(message => !message.readAt).length ?? 0;
  return <div className="app-shell min-h-screen" style={{ "--app-accent": presentation.data?.accentColor ?? "#0f766e" } as React.CSSProperties}>
    <aside className={cn("app-sidebar", mobileOpen && "app-sidebar-open")}>
      <div className="flex items-center justify-between px-5 pt-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300"><Stethoscope className="h-5 w-5" /></span><div><p className="text-sm font-bold text-white">{presentation.data?.appName ?? "نواقص الصيدلية"}</p><p className="mt-0.5 text-xs text-slate-400">متابعة مشتركة وفورية</p></div></div><button className="text-slate-300 lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button></div>
      <nav className="mt-10 space-y-1 px-3">{allowed.map(item => <button key={item.path} onClick={() => { setLocation(item.path); setMobileOpen(false); }} className={cn("nav-link", location === item.path && "nav-link-active")}><item.icon className="h-4 w-4" />{item.label}</button>)}</nav>
      <div className="mt-auto border-t border-white/10 p-4"><button onClick={() => { setLocation("/profile"); setMobileOpen(false); }} className="mb-3 flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-right transition hover:bg-white/10"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">{user?.name?.slice(0, 1)}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{user?.name}</p><p className="truncate text-xs text-slate-400">ملفي الشخصي وإنجازاتي</p></div></button><button onClick={logout} className="nav-link w-full text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"><LogOut className="h-4 w-4" />تسجيل الخروج</button></div>
    </aside>
    {mobileOpen && <button className="mobile-menu-scrim fixed inset-0 z-30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" />}
    <div className="lg:pr-72"><header className="app-topbar sticky top-0 z-20 backdrop-blur"><div className="app-topbar-inner flex h-16 items-center px-4 sm:px-7"><Button variant="ghost" className={cn("mobile-menu-trigger lg:hidden", mobileOpen && "mobile-menu-trigger-open")} onClick={() => setMobileOpen(value => !value)} aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}><span className="mobile-menu-icon">{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</span><span>القائمة</span></Button><span className="mr-2 truncate text-sm font-bold text-slate-800 sm:hidden">{presentation.data?.appName ?? "نواقص الصيدلية"}</span><div className="mr-auto flex items-center gap-2"><span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><ShieldCheck className="h-4 w-4 text-teal-700" />جلسة محلية آمنة</span><Button variant="ghost" size="icon" className="relative" onClick={() => setInboxOpen(value => !value)} aria-label="الرسائل"><Bell className="h-5 w-5 text-slate-700" />{unread > 0 && <span className="absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">{unread}</span>}</Button></div></div>{presentation.data?.topNotice && <div className="border-t border-teal-100 bg-teal-50 px-4 py-2 text-center text-xs font-semibold text-teal-800 sm:px-7">{presentation.data.topNotice}</div>}</header>{inboxOpen && <section className="app-inbox fixed left-3 z-30 w-[min(23rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-800">الرسائل</h2><Button variant="ghost" size="icon" onClick={() => setInboxOpen(false)}><X className="h-4 w-4" /></Button></div><div className="max-h-80 space-y-2 overflow-auto">{inbox.data?.map(message => <article key={message.id} className={`rounded-xl border p-3 ${message.readAt ? "border-slate-100 bg-white" : "border-teal-100 bg-teal-50/60"}`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold text-slate-800">{message.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{message.body}</p></div>{!message.readAt && <Button size="sm" variant="ghost" className="shrink-0 text-teal-700" onClick={() => readMessage.mutate({ id: message.id })}><CheckCheck className="h-4 w-4" /></Button>}</div></article>)}{!inbox.isLoading && inbox.data?.length === 0 && <p className="empty-note">لا توجد رسائل جديدة.</p>}</div></section>}<main className="app-main mx-auto max-w-7xl p-4 sm:p-7">{children}</main></div>
  </div>;
}
