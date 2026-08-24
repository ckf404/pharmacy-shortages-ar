import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, LayoutPanelTop, Loader2, Palette, Plus, Save, SlidersHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { hasPermission } from "@/lib/permissions";
import { trpc } from "@/lib/trpc";

const standardForms = ["أقراص", "شراب", "مرهم", "نقط", "كريم", "حقن"];
const navItems = [
  { key: "shortages", label: "نواقص اليوم" }, { key: "profile", label: "حسابي وإنجازاتي" },
  { key: "suppliers", label: "المخازن" }, { key: "users", label: "المستخدمون" },
  { key: "control", label: "تحكم المشرف" }, { key: "settings", label: "مركز التحكم" },
];
const empty = {
  appName: "نواقص الصيدلية", pharmacyName: "الصيدلية", pharmacyPhone: "", pharmacyAddress: "",
  supplierMessageIntro: "طلب نواقص من {pharmacyName} — {date}", supplierMessageFooter: "برجاء تأكيد التوفر وموعد التسليم. شكرًا.",
  welcomeText: "كل نقص، وكل مخزن، في قائمة يومية واضحة.", dashboardSubtitle: "تابع حالة الصنف من التسجيل حتى الاستلام دون فقدان سجل اليوم.",
  accentColor: "#0f766e", topNotice: "", navigationOrder: "shortages,profile,suppliers,users,control,settings",
  visibleNavigation: "shortages,profile,suppliers,users,control,settings", enabledDosageForms: standardForms.join(","), quantityPresets: "1,2,3,4",
  showDashboardStats: true, showShortageForm: true, showPriorityPicker: true, showSupplierPicker: true, showNotesField: true, showInvoiceArchive: true,
};

export default function SupervisorControls() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const presentation = trpc.presentation.get.useQuery();
  const [form, setForm] = useState(empty);
  const [customType, setCustomType] = useState("");
  const [previewName, setPreviewName] = useState("مثال للصنف");
  const [previewType, setPreviewType] = useState("أقراص");
  const [previewQuantity, setPreviewQuantity] = useState("1");
  const [previewSaved, setPreviewSaved] = useState(false);
  const update = trpc.presentation.update.useMutation({ onSuccess: () => utils.presentation.get.invalidate() });
  const canManage = hasPermission(user, "settings_manage");

  useEffect(() => {
    if (!presentation.data) return;
    setForm({
      ...empty, ...presentation.data,
      pharmacyPhone: presentation.data.pharmacyPhone ?? "", pharmacyAddress: presentation.data.pharmacyAddress ?? "",
      topNotice: presentation.data.topNotice ?? "", navigationOrder: presentation.data.navigationOrder ?? empty.navigationOrder,
      visibleNavigation: presentation.data.visibleNavigation ?? empty.visibleNavigation,
      enabledDosageForms: presentation.data.enabledDosageForms ?? empty.enabledDosageForms,
    });
  }, [presentation.data]);

  const selectedForms = useMemo(() => form.enabledDosageForms.split(",").map(item => item.trim()).filter(Boolean), [form.enabledDosageForms]);
  const allForms = useMemo(() => Array.from(new Set([...standardForms, ...selectedForms])), [selectedForms]);
  const visibleNav = useMemo(() => form.visibleNavigation.split(",").filter(Boolean), [form.visibleNavigation]);
  const quantityChoices = useMemo(() => form.quantityPresets.split(",").filter(Boolean), [form.quantityPresets]);
  const switches = [
    { key: "showDashboardStats" as const, label: "عدادات نواقص اليوم" }, { key: "showShortageForm" as const, label: "نموذج تسجيل الصنف" },
    { key: "showPriorityPicker" as const, label: "اختيار الأولوية" }, { key: "showSupplierPicker" as const, label: "اختيار المخزن المقترح" },
    { key: "showNotesField" as const, label: "حقل الملاحظات" }, { key: "showInvoiceArchive" as const, label: "أرشيف الفواتير اليومية" },
  ];

  const toggleCsv = (field: "enabledDosageForms" | "visibleNavigation", value: string) => setForm(current => {
    const values = current[field].split(",").map(item => item.trim()).filter(Boolean);
    const next = values.includes(value) ? values.filter(item => item !== value) : [...values, value];
    return { ...current, [field]: next.join(",") };
  });
  const addCustomType = () => {
    const next = customType.trim().replace(/,/g, "");
    if (!next) return;
    if (selectedForms.includes(next)) return toast.error("هذا النوع موجود بالفعل.");
    setForm(current => ({ ...current, enabledDosageForms: [...selectedForms, next].join(",") }));
    setPreviewType(next);
    setCustomType("");
    toast.success("أُضيف النوع للمعاينة. احفظ لتظهر الاختيارات للمستخدمين.");
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedForms.length === 0) return toast.error("اختر نوع صنف واحدًا على الأقل.");
    if (!visibleNav.includes("settings")) return toast.error("مركز التحكم يجب أن يبقى ظاهرًا للمشرف.");
    if (!/^\d+(,\d+){0,7}$/.test(form.quantityPresets)) return toast.error("أرقام الكمية تكون مفصولة بفواصل، مثل 1,2,3,4.");
    await update.mutateAsync({ ...form, pharmacyPhone: form.pharmacyPhone || null, pharmacyAddress: form.pharmacyAddress || null, topNotice: form.topNotice || null });
    toast.success("تم تطبيق الإعدادات والمعاينة على جميع المستخدمين.");
  };
  if (!canManage) return <section className="panel"><h1 className="page-title">تحكم المشرف</h1><p className="mt-2 text-slate-500">هذه الصفحة متاحة للمشرف أو المدير فقط.</p></section>;

  return <div className="space-y-6">
    <header><p className="eyebrow">تحكم المشرف الكامل</p><h1 className="page-title">خصّص ما يراه المستخدم وجربه قبل الحفظ</h1><p className="mt-1 text-sm text-slate-500">تظهر المعاينة في الجانب فورًا، بينما يصبح التعديل متاحًا لكل المستخدمين بعد الضغط على الحفظ.</p></header>
    <form onSubmit={save} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,.72fr)]">
      <div className="space-y-5">
        <section className="panel"><div className="panel-heading"><span className="icon-surface"><Palette className="h-5 w-5" /></span><div><h2>هوية التطبيق والنصوص الأساسية</h2><p>تتحكم في اسم التطبيق والرسائل التي يراها المستخدم من الدخول إلى لوحة النواقص.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>اسم التطبيق</Label><Input value={form.appName} onChange={event => setForm({ ...form, appName: event.target.value })} required /></div><div className="space-y-2"><Label>لون الهوية</Label><Input type="color" value={form.accentColor} onChange={event => setForm({ ...form, accentColor: event.target.value })} className="h-10 p-1" /></div><div className="space-y-2 sm:col-span-2"><Label>عبارة الترحيب</Label><Input value={form.welcomeText} onChange={event => setForm({ ...form, welcomeText: event.target.value })} required /></div><div className="space-y-2 sm:col-span-2"><Label>وصف لوحة النواقص</Label><Textarea value={form.dashboardSubtitle} onChange={event => setForm({ ...form, dashboardSubtitle: event.target.value })} required /></div><div className="space-y-2 sm:col-span-2"><Label>تنبيه أعلى التطبيق <span className="text-slate-400">اختياري</span></Label><Input value={form.topNotice} onChange={event => setForm({ ...form, topNotice: event.target.value })} placeholder="مثال: متابعة النواقص العاجلة قبل الإرسال" /></div></div></section>
        <section className="panel"><div className="panel-heading"><span className="icon-surface"><SlidersHorizontal className="h-5 w-5" /></span><div><h2>الأقسام والحقول الظاهرة</h2><p>أي خيار مغلق هنا يختفي من واجهة المستخدم، ويمكنك إعادته في أي وقت.</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{switches.map(item => <label key={item.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><span>{item.label}</span><Switch checked={form[item.key]} onCheckedChange={value => setForm({ ...form, [item.key]: value })} /></label>)}</div></section>
        <section className="panel"><div className="panel-heading"><span className="icon-surface"><LayoutPanelTop className="h-5 w-5" /></span><div><h2>القائمة والتنقل</h2><p>اختر الصفحات الظاهرة. يبقى مركز التحكم متاحًا لحماية الإدارة.</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{navItems.map(item => <label key={item.key} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm"><span>{item.label}</span><Switch disabled={item.key === "settings"} checked={visibleNav.includes(item.key)} onCheckedChange={() => toggleCsv("visibleNavigation", item.key)} /></label>)}</div></section>
        <section className="panel"><div className="panel-heading"><span className="icon-surface"><Plus className="h-5 w-5" /></span><div><h2>اختيارات تسجيل الصنف</h2><p>أضف نوعًا جديدًا بنفسك؛ سيظهر للموظفين بعد الحفظ، بجانب الكميات السريعة التي تختارها.</p></div></div><div className="mt-5"><Label>الأنواع المتاحة</Label><div className="mt-2 flex flex-wrap gap-2">{allForms.map(item => <Button key={item} type="button" variant={selectedForms.includes(item) ? "default" : "outline"} className={selectedForms.includes(item) ? "bg-teal-700 hover:bg-teal-800" : "bg-white"} onClick={() => toggleCsv("enabledDosageForms", item)}>{item}</Button>)}</div></div><div className="mt-4 flex gap-2"><Input value={customType} onChange={event => setCustomType(event.target.value)} placeholder="أضف نوعًا جديدًا مثل: بخاخ" /><Button type="button" variant="outline" onClick={addCustomType}><Plus className="ml-1 h-4 w-4" />إضافة</Button></div><div className="mt-5 space-y-2"><Label>أرقام الكمية السريعة</Label><Input dir="ltr" value={form.quantityPresets} onChange={event => setForm({ ...form, quantityPresets: event.target.value.replace(/[^0-9,]/g, "") })} placeholder="1,2,3,4" /><p className="text-xs text-slate-500">يمكنك كتابة حتى 8 اختيارات؛ خيار «أخرى» يبقى متاحًا للكتابة اليدوية.</p></div></section>
        <section className="panel"><div className="panel-heading"><span className="icon-surface"><Sparkles className="h-5 w-5" /></span><div><h2>الصيدلية ورسالة المخزن</h2><p>تتحدث المعاينة فورًا بما تكتبه هنا.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>اسم الصيدلية</Label><Input value={form.pharmacyName} onChange={event => setForm({ ...form, pharmacyName: event.target.value })} required /></div><div className="space-y-2"><Label>هاتف الصيدلية</Label><Input dir="ltr" value={form.pharmacyPhone} onChange={event => setForm({ ...form, pharmacyPhone: event.target.value })} /></div><div className="space-y-2 sm:col-span-2"><Label>العنوان</Label><Input value={form.pharmacyAddress} onChange={event => setForm({ ...form, pharmacyAddress: event.target.value })} /></div><div className="space-y-2 sm:col-span-2"><Label>بداية رسالة المخزن</Label><Textarea value={form.supplierMessageIntro} onChange={event => setForm({ ...form, supplierMessageIntro: event.target.value })} required /></div><div className="space-y-2 sm:col-span-2"><Label>نهاية رسالة المخزن</Label><Textarea value={form.supplierMessageFooter} onChange={event => setForm({ ...form, supplierMessageFooter: event.target.value })} required /></div></div></section>
        <Button type="submit" className="h-11 w-full bg-teal-700 hover:bg-teal-800" disabled={update.isPending}>{update.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}تطبيق الإعدادات لجميع المستخدمين</Button>
      </div>
      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <section className="message-preview"><p className="text-xs font-bold text-teal-100">معاينة رسالة المخزن</p><pre>{form.supplierMessageIntro.replaceAll("{pharmacyName}", form.pharmacyName || "الصيدلية").replaceAll("{date}", "2026-08-24").replaceAll("{supplierName}", "مخزن تجريبي")}\nالمخزن: مخزن تجريبي\n\n1. فيتامين ب — {previewType} × {previewQuantity} — مهم\n\n{form.supplierMessageFooter}</pre></section>
        <section className="live-preview-card" style={{ "--preview-accent": form.accentColor } as React.CSSProperties}><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-500">معاينة عملية للمستخدم</p><h2 className="mt-1 font-bold text-slate-800">{form.appName}</h2></div><span className="live-preview-dot" /></div>{form.topNotice && <p className="live-preview-notice">{form.topNotice}</p>}{form.showShortageForm ? <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-white p-3"><Input value={previewName} onChange={event => { setPreviewName(event.target.value); setPreviewSaved(false); }} placeholder="اسم الصنف" /><div className="flex flex-wrap gap-1.5">{selectedForms.map(item => <button key={item} type="button" onClick={() => { setPreviewType(item); setPreviewSaved(false); }} className={`live-choice ${previewType === item ? "live-choice-active" : ""}`}>{item}</button>)}</div><div className="flex flex-wrap gap-1.5">{quantityChoices.map(item => <button key={item} type="button" onClick={() => { setPreviewQuantity(item); setPreviewSaved(false); }} className={`live-choice ${previewQuantity === item ? "live-choice-active" : ""}`}>× {item}</button>)}</div>{form.showPriorityPicker && <p className="text-xs text-amber-700">الأولوية: مهم</p>}{form.showSupplierPicker && <p className="text-xs text-slate-500">المخزن المقترح: اختياري</p>}{form.showNotesField && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">حقل الملاحظات ظاهر</p>}<Button type="button" size="sm" className="w-full" style={{ backgroundColor: form.accentColor }} onClick={() => setPreviewSaved(true)}>تجربة إضافة الصنف</Button>{previewSaved && <p className="rounded-lg bg-emerald-50 p-2 text-center text-xs font-bold text-emerald-700">تمت التجربة بنجاح — سيظهر هذا الشكل للمستخدم بعد الحفظ.</p>}</div> : <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-500">نموذج التسجيل مخفي حاليًا حسب اختيارك.</p>}</section>
        <section className="panel"><div className="flex items-center gap-2"><Eye className="h-4 w-4 text-teal-700" /><h2 className="font-bold text-slate-800">خلاصة الظهور</h2></div><div className="mt-4 space-y-2 text-sm">{switches.map(item => <div key={item.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span>{item.label}</span>{form[item.key] ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-slate-400" />}</div>)}</div></section>
      </aside>
    </form>
  </div>;
}
