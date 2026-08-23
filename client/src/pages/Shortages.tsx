import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { hasPermission } from "@/lib/permissions";
import { useAuth } from "@/_core/hooks/useAuth";
import { CalendarDays, Check, CheckCircle2, ClipboardList, History, Loader2, MessageCircleMore, PackagePlus, Pill, RotateCcw, Trash2, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const priorityText = { normal: "عادي", important: "مهم", urgent: "عاجل للعميل" } as const;
const priorityClass = { normal: "bg-sky-50 text-sky-700 ring-sky-100", important: "bg-amber-50 text-amber-800 ring-amber-100", urgent: "bg-rose-50 text-rose-700 ring-rose-100" } as const;
const dosageForms = ["أقراص", "شراب", "مرهم", "نقط", "كريم"] as const;
type DosageForm = typeof dosageForms[number];

export default function Shortages() {
  const [form, setForm] = useState({ productName: "", dosageForm: "أقراص" as DosageForm, quantityChoice: "1", customQuantity: "", priority: "normal" as "normal" | "important" | "urgent", suggestedSupplierId: "none", notes: "" });
  const [selected, setSelected] = useState<number[]>([]);
  const [orderSupplierId, setOrderSupplierId] = useState("");
  const [archiveDayKey, setArchiveDayKey] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const dashboard = trpc.shortages.dashboard.useQuery();
  const archive = trpc.shortages.archive.useQuery();
  const historicalInvoice = trpc.shortages.invoice.useQuery({ dayKey: archiveDayKey ?? "1970-01-01" }, { enabled: Boolean(archiveDayKey) });
  const presentation = trpc.presentation.get.useQuery();
  const suppliers = trpc.suppliers.list.useQuery();
  const refresh = async () => { await Promise.all([utils.shortages.dashboard.invalidate(), utils.shortages.archive.invalidate(), utils.shortages.invoice.invalidate(), utils.shortages.activity.invalidate()]); };
  const addItem = trpc.shortages.create.useMutation({ onSuccess: refresh });
  const setStatus = trpc.shortages.setStatus.useMutation({ onSuccess: refresh });
  const deleteItem = trpc.shortages.delete.useMutation({ onSuccess: refresh });
  const prepareOrder = trpc.shortages.prepareWhatsApp.useMutation();

  const openItems = useMemo(() => dashboard.data?.items.filter(item => item.status === "open") ?? [], [dashboard.data]);
  const receivedItems = useMemo(() => dashboard.data?.items.filter(item => item.status === "received") ?? [], [dashboard.data]);
  const activeSuppliers = suppliers.data?.filter(supplier => supplier.active) ?? [];
  const previousInvoices = archive.data?.filter(day => day.dayKey !== dashboard.data?.day.dayKey) ?? [];
  const canCreate = hasPermission(user, "shortages_create");
  const canUpdate = hasPermission(user, "shortages_update");
  const canDelete = hasPermission(user, "shortages_delete");
  const canPrepare = hasPermission(user, "orders_prepare");

  const createItem = async (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = form.quantityChoice === "custom" ? Number(form.customQuantity) : Number(form.quantityChoice);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return toast.error("اكتب كمية صحيحة من 1 إلى 999.");
    await addItem.mutateAsync({ productName: form.productName, dosageForm: form.dosageForm, quantity, priority: form.priority, suggestedSupplierId: form.suggestedSupplierId === "none" ? null : Number(form.suggestedSupplierId), notes: form.notes || null });
    setForm({ productName: "", dosageForm: "أقراص", quantityChoice: "1", customQuantity: "", priority: "normal", suggestedSupplierId: "none", notes: "" });
    toast.success("تمت إضافة الصنف إلى فاتورة اليوم");
  };

  const toggleSelected = (id: number) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const sendReview = async () => {
    if (!orderSupplierId || selected.length === 0) return;
    const result = await prepareOrder.mutateAsync({ supplierId: Number(orderSupplierId), itemIds: selected });
    const androidBridge = (window as Window & { PharmacyAndroid?: { openWhatsApp: (url: string) => void } }).PharmacyAndroid;
    if (androidBridge?.openWhatsApp) androidBridge.openWhatsApp(result.whatsappUrl);
    else window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
    toast.success("تم تجهيز الرسالة وفتح واتساب للمراجعة.");
  };

  const renderItem = (item: any, received = false) => <li key={item.id} className={`group rounded-2xl border p-4 shadow-sm transition ${received ? "border-emerald-100 bg-emerald-50/45" : "border-slate-100 bg-white hover:border-teal-100 hover:shadow-md"}`}>
    <div className="flex items-start gap-3">
      {!received && <Checkbox checked={selected.includes(item.id)} onCheckedChange={() => toggleSelected(item.id)} aria-label={`تحديد ${item.productName}`} className="mt-1" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className={`font-bold ${received ? "text-slate-500 line-through decoration-emerald-500 decoration-2" : "text-slate-800"}`}>{item.productName}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${priorityClass[item.priority as keyof typeof priorityClass]}`}>{priorityText[item.priority as keyof typeof priorityText]}</span>{received && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white"><CheckCircle2 className="h-3.5 w-3.5" />تم الاستلام</span>}</div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span><Pill className="ml-1 inline h-3.5 w-3.5" />{item.dosageForm} · الكمية {item.quantity}</span>{item.suggestedSupplierName && <span><Truck className="ml-1 inline h-3.5 w-3.5" />{item.suggestedSupplierName}</span>}{item.notes && <span>{item.notes}</span>}{received && item.receivedAt && <span>استُلم {new Date(item.receivedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>}</div>
      </div>
      <div className="flex shrink-0 gap-1">{canUpdate && (received ? <Button variant="ghost" size="icon" className="text-slate-500 hover:text-teal-700" onClick={() => setStatus.mutate({ id: item.id, status: "open" })} title="إرجاع للقائمة"><RotateCcw className="h-4 w-4" /></Button> : <Button variant="ghost" size="icon" className="text-teal-700 hover:bg-teal-50" onClick={() => { setSelected(current => current.filter(value => value !== item.id)); setStatus.mutate({ id: item.id, status: "received" }); }} title="تم الاستلام"><Check className="h-5 w-5" /></Button>)}{canDelete && <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-rose-50 hover:text-rose-700" onClick={() => window.confirm(`حذف «${item.productName}» من القائمة؟`) && deleteItem.mutate({ id: item.id })} title="حذف"><Trash2 className="h-4 w-4" /></Button>}</div>
    </div>
  </li>;

  if (dashboard.isLoading) return <div className="page-loader"><Loader2 className="h-6 w-6 animate-spin" />جاري تجهيز فاتورة اليوم…</div>;

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="eyebrow">سجل مشترك لجميع المستخدمين</p><h1 className="page-title">فاتورة نواقص الأدوية اليومية</h1><p className="mt-1 text-sm text-slate-500">{presentation.data?.dashboardSubtitle ?? "تابع حالة الصنف من التسجيل حتى الاستلام دون فقدان سجل اليوم."}</p></div><span className="date-chip">فاتورة {dashboard.data?.day.dayKey}</span></header>
    <section className="invoice-pharmacy"><Pill className="h-5 w-5 text-teal-700" /><div><strong>{presentation.data?.pharmacyName ?? "الصيدلية"}</strong><p>{[presentation.data?.pharmacyPhone, presentation.data?.pharmacyAddress].filter(Boolean).join(" — ") || "بيانات الصيدلية تظهر في فاتورة اليوم ورسالة المخزن."}</p></div></section>
    <section className="grid gap-3 sm:grid-cols-3"><div className="metric-card"><ClipboardList className="metric-icon bg-sky-50 text-sky-700" /><div><p>نواقص مفتوحة</p><strong>{openItems.length}</strong></div></div><div className="metric-card"><Check className="metric-icon bg-emerald-50 text-emerald-700" /><div><p>تم استلامه</p><strong>{receivedItems.length}</strong></div></div><div className="metric-card"><Truck className="metric-icon bg-violet-50 text-violet-700" /><div><p>المخازن المتاحة</p><strong>{activeSuppliers.length}</strong></div></div></section>
    <section className="dashboard-grid">
      {canCreate ? <form className="panel h-fit" onSubmit={createItem}><div className="panel-heading"><span className="icon-surface"><PackagePlus className="h-5 w-5" /></span><div><h2>تسجيل صنف ناقص</h2><p>اختر النوع والكمية بسرعة؛ وتظهر في الفاتورة ورسالة المخزن.</p></div></div><div className="mt-6 space-y-4"><div className="space-y-2"><Label htmlFor="product">اسم الصنف</Label><Input id="product" value={form.productName} onChange={event => setForm({ ...form, productName: event.target.value })} placeholder="مثال: أوجمنتين 1 جم" required /></div><div className="space-y-2"><Label>نوع الصنف</Label><div className="grid grid-cols-2 gap-2">{dosageForms.map(value => <Button key={value} type="button" variant={form.dosageForm === value ? "default" : "outline"} className={form.dosageForm === value ? "bg-teal-700 hover:bg-teal-800" : "bg-white"} onClick={() => setForm({ ...form, dosageForm: value })}>{value}</Button>)}</div></div><div className="space-y-2"><Label>الكمية</Label><div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4].map(value => <Button key={value} type="button" variant={form.quantityChoice === String(value) ? "default" : "outline"} className={form.quantityChoice === String(value) ? "bg-teal-700 hover:bg-teal-800" : "bg-white"} onClick={() => setForm({ ...form, quantityChoice: String(value) })}>{value}</Button>)}<Button type="button" variant={form.quantityChoice === "custom" ? "default" : "outline"} className={form.quantityChoice === "custom" ? "bg-teal-700 hover:bg-teal-800" : "bg-white"} onClick={() => setForm({ ...form, quantityChoice: "custom" })}>أخرى</Button></div>{form.quantityChoice === "custom" && <Input className="mt-2" type="number" min="1" max="999" value={form.customQuantity} onChange={event => setForm({ ...form, customQuantity: event.target.value })} placeholder="اكتب الكمية" required />}</div><div className="space-y-2"><Label>الأولوية</Label><Select value={form.priority} onValueChange={value => setForm({ ...form, priority: value as typeof form.priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">عادي</SelectItem><SelectItem value="important">مهم</SelectItem><SelectItem value="urgent">عاجل للعميل</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>المخزن المقترح <span className="text-slate-400">اختياري</span></Label><Select value={form.suggestedSupplierId} onValueChange={value => setForm({ ...form, suggestedSupplierId: value })}><SelectTrigger><SelectValue placeholder="دون مخزن محدد" /></SelectTrigger><SelectContent><SelectItem value="none">دون مخزن محدد</SelectItem>{activeSuppliers.map(supplier => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="notes">ملاحظة <span className="text-slate-400">اختيارية</span></Label><Textarea id="notes" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="التركيز أو ملاحظة العميل" /></div><Button className="h-11 w-full bg-teal-700 hover:bg-teal-800" disabled={addItem.isPending}>{addItem.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}إضافة إلى فاتورة اليوم</Button></div></form> : <section className="panel h-fit"><div className="panel-heading"><span className="icon-surface"><PackagePlus className="h-5 w-5" /></span><div><h2>الإضافة مقيدة</h2><p>يمكن للمشرف تفعيل صلاحية إضافة النواقص لحسابك.</p></div></div></section>}
      <div className="space-y-5"><section className="panel"><div className="panel-heading"><span className="icon-surface"><ClipboardList className="h-5 w-5" /></span><div><h2>فاتورة اليوم</h2><p>{openItems.length ? "الأصناف المفتوحة أولاً، وتبقى المستلمة ظاهرة ومشطوبة في نفس الفاتورة." : receivedItems.length ? "كل أصناف اليوم استُلمت وبقيت كمرجع للفواتير." : "لا توجد نواقص مسجلة اليوم."}</p></div></div>{(openItems.length + receivedItems.length) > 0 && <><ul className="mt-5 space-y-3">{[...openItems, ...receivedItems].map(item => renderItem(item, item.status === "received"))}</ul>{openItems.length > 0 && canPrepare && <><div className="mt-5 rounded-xl bg-teal-50 p-3 sm:flex sm:items-center sm:gap-3"><Select value={orderSupplierId} onValueChange={setOrderSupplierId}><SelectTrigger className="bg-white sm:w-56"><SelectValue placeholder="اختر مخزنًا للإرسال" /></SelectTrigger><SelectContent>{activeSuppliers.map(supplier => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select><Button onClick={sendReview} disabled={!orderSupplierId || selected.length === 0 || prepareOrder.isPending} className="mt-2 h-10 w-full bg-teal-700 hover:bg-teal-800 sm:mt-0 sm:w-auto"><MessageCircleMore className="ml-2 h-4 w-4" />إرسال واتساب ({selected.length})</Button></div><p className="mt-2 text-xs text-slate-500">يتبع نص الرسالة قالب المشرف ويُفتح واتساب للمراجعة فقط.</p></>}</>}</section></div>
    </section>
    <section className="panel"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="panel-heading"><span className="icon-surface bg-violet-50 text-violet-700"><History className="h-5 w-5" /></span><div><h2>أرشيف الفواتير اليومية</h2><p>كل يوم محفوظ بتاريخ مستقل؛ تُرحّل فقط الأصناف التي لم تُعلَّم كمستلمة.</p></div></div><span className="text-xs font-semibold text-slate-500">{previousInvoices.length} فاتورة سابقة</span></div><div className="archive-calendar mt-5">{previousInvoices.map(day => <button key={day.id} type="button" onClick={() => setArchiveDayKey(day.dayKey)} className={`archive-day ${archiveDayKey === day.dayKey ? "archive-day-active" : ""}`}><CalendarDays className="h-4 w-4" /><strong>{day.dayKey}</strong><span>{day.openCount} غير مستلم · {day.receivedCount} مستلم</span></button>)}{previousInvoices.length === 0 && <p className="empty-note">ستظهر هنا الفواتير عند مرور يوم جديد أو بعد تشغيل الترحيل.</p>}</div>{archiveDayKey && <div className="archive-invoice mt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-800">{presentation.data?.pharmacyName ?? "الصيدلية"} — فاتورة {archiveDayKey}</h3><p className="mt-1 text-xs text-slate-500">{[presentation.data?.pharmacyPhone, presentation.data?.pharmacyAddress].filter(Boolean).join(" — ") || "سجل للقراءة فقط ولا يغيّر فاتورة اليوم."}</p></div><Button variant="ghost" size="sm" onClick={() => setArchiveDayKey(null)}>إغلاق</Button></div>{historicalInvoice.isLoading ? <div className="page-loader py-8"><Loader2 className="h-5 w-5 animate-spin" />جاري تحميل الفاتورة…</div> : <ul className="mt-4 space-y-2">{historicalInvoice.data?.items.map(item => <li key={item.id} className={`rounded-xl border p-3 text-sm ${item.status === "received" ? "border-emerald-100 bg-emerald-50/40" : "border-slate-100 bg-white"}`}><div className="flex flex-wrap items-center gap-2"><strong className={item.status === "received" ? "text-slate-500 line-through" : "text-slate-800"}>{item.productName}</strong><span className="text-xs text-slate-500">{item.dosageForm} · الكمية {item.quantity}</span>{item.status === "received" && <span className="text-xs font-bold text-emerald-700">تم الاستلام</span>}</div></li>)}</ul>}</div>}</section>
  </div>;
}
