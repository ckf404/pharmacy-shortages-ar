import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { hasPermission } from "@/lib/permissions";
import { useAuth } from "@/_core/hooks/useAuth";
import { Check, ClipboardList, Loader2, MessageCircleMore, PackagePlus, RotateCcw, Trash2, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const priorityText = { normal: "عادي", important: "مهم", urgent: "عاجل للعميل" } as const;
const priorityClass = { normal: "bg-sky-50 text-sky-700 ring-sky-100", important: "bg-amber-50 text-amber-800 ring-amber-100", urgent: "bg-rose-50 text-rose-700 ring-rose-100" } as const;

export default function Shortages() {
  const [form, setForm] = useState({ productName: "", priority: "normal" as "normal" | "important" | "urgent", suggestedSupplierId: "none", notes: "" });
  const [selected, setSelected] = useState<number[]>([]);
  const [orderSupplierId, setOrderSupplierId] = useState("");
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const dashboard = trpc.shortages.dashboard.useQuery();
  const presentation = trpc.presentation.get.useQuery();
  const suppliers = trpc.suppliers.list.useQuery();
  const refresh = async () => { await Promise.all([utils.shortages.dashboard.invalidate(), utils.shortages.activity.invalidate()]); };
  const addItem = trpc.shortages.create.useMutation({ onSuccess: refresh });
  const setStatus = trpc.shortages.setStatus.useMutation({ onSuccess: refresh });
  const deleteItem = trpc.shortages.delete.useMutation({ onSuccess: refresh });
  const prepareOrder = trpc.shortages.prepareWhatsApp.useMutation();

  const openItems = useMemo(() => dashboard.data?.items.filter(item => item.status === "open") ?? [], [dashboard.data]);
  const receivedItems = useMemo(() => dashboard.data?.items.filter(item => item.status === "received") ?? [], [dashboard.data]);
  const activeSuppliers = suppliers.data?.filter(supplier => supplier.active) ?? [];
  const canCreate = hasPermission(user, "shortages_create");
  const canUpdate = hasPermission(user, "shortages_update");
  const canDelete = hasPermission(user, "shortages_delete");
  const canPrepare = hasPermission(user, "orders_prepare");

  const createItem = async (event: React.FormEvent) => {
    event.preventDefault();
    await addItem.mutateAsync({
      productName: form.productName,
      priority: form.priority,
      suggestedSupplierId: form.suggestedSupplierId === "none" ? null : Number(form.suggestedSupplierId),
      notes: form.notes || null,
    });
    setForm({ productName: "", priority: "normal", suggestedSupplierId: "none", notes: "" });
    toast.success("تمت إضافة الصنف إلى قائمة اليوم");
  };

  const toggleSelected = (id: number) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const sendReview = async () => {
    if (!orderSupplierId || selected.length === 0) return;
    const result = await prepareOrder.mutateAsync({ supplierId: Number(orderSupplierId), itemIds: selected });
    window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
    toast.success("تم تجهيز الرسالة وفتح واتساب للمراجعة.");
  };

  const renderItem = (item: any, received = false) => <li key={item.id} className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-teal-100 hover:shadow-md">
    <div className="flex items-start gap-3">
      {!received && <Checkbox checked={selected.includes(item.id)} onCheckedChange={() => toggleSelected(item.id)} aria-label={`تحديد ${item.productName}`} className="mt-1" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-slate-800">{item.productName}</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${priorityClass[item.priority as keyof typeof priorityClass]}`}>{priorityText[item.priority as keyof typeof priorityText]}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {item.suggestedSupplierName && <span><Truck className="ml-1 inline h-3.5 w-3.5" />{item.suggestedSupplierName}</span>}
          {item.notes && <span>{item.notes}</span>}
          {received && item.receivedAt && <span>استُلم {new Date(item.receivedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {canUpdate && (received ? <Button variant="ghost" size="icon" className="text-slate-500 hover:text-teal-700" onClick={() => setStatus.mutate({ id: item.id, status: "open" })} title="إرجاع للقائمة"><RotateCcw className="h-4 w-4" /></Button> : <Button variant="ghost" size="icon" className="text-teal-700 hover:bg-teal-50" onClick={() => setStatus.mutate({ id: item.id, status: "received" })} title="تم الاستلام"><Check className="h-5 w-5" /></Button>)}
        {canDelete && <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-rose-50 hover:text-rose-700" onClick={() => window.confirm(`حذف «${item.productName}» من القائمة؟`) && deleteItem.mutate({ id: item.id })} title="حذف"><Trash2 className="h-4 w-4" /></Button>}
      </div>
    </div>
  </li>;

  if (dashboard.isLoading) return <div className="page-loader"><Loader2 className="h-6 w-6 animate-spin" />جاري تجهيز قائمة اليوم…</div>;

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div><p className="eyebrow">سجل مشترك لجميع المستخدمين</p><h1 className="page-title">نواقص الأدوية اليومية</h1><p className="mt-1 text-sm text-slate-500">{presentation.data?.dashboardSubtitle ?? "تابع حالة الصنف من التسجيل حتى الاستلام دون فقدان سجل اليوم."}</p></div>
      <span className="date-chip">{dashboard.data?.day.dayKey}</span>
    </header>
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="metric-card"><ClipboardList className="metric-icon bg-sky-50 text-sky-700" /><div><p>نواقص مفتوحة</p><strong>{openItems.length}</strong></div></div>
      <div className="metric-card"><Check className="metric-icon bg-emerald-50 text-emerald-700" /><div><p>تم استلامه</p><strong>{receivedItems.length}</strong></div></div>
      <div className="metric-card"><Truck className="metric-icon bg-violet-50 text-violet-700" /><div><p>المخازن المتاحة</p><strong>{activeSuppliers.length}</strong></div></div>
    </section>
    <section className="dashboard-grid">
      {canCreate ? <form className="panel h-fit" onSubmit={createItem}>
        <div className="panel-heading"><span className="icon-surface"><PackagePlus className="h-5 w-5" /></span><div><h2>تسجيل صنف ناقص</h2><p>يظهر فورًا ضمن القائمة المفتوحة.</p></div></div>
        <div className="mt-6 space-y-4">
          <div className="space-y-2"><Label htmlFor="product">اسم الصنف</Label><Input id="product" value={form.productName} onChange={event => setForm({ ...form, productName: event.target.value })} placeholder="مثال: أوجمنتين 1 جم" required /></div>
          <div className="space-y-2"><Label>الأولوية</Label><Select value={form.priority} onValueChange={value => setForm({ ...form, priority: value as typeof form.priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">عادي</SelectItem><SelectItem value="important">مهم</SelectItem><SelectItem value="urgent">عاجل للعميل</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>المخزن المقترح <span className="text-slate-400">اختياري</span></Label><Select value={form.suggestedSupplierId} onValueChange={value => setForm({ ...form, suggestedSupplierId: value })}><SelectTrigger><SelectValue placeholder="دون مخزن محدد" /></SelectTrigger><SelectContent><SelectItem value="none">دون مخزن محدد</SelectItem>{activeSuppliers.map(supplier => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="notes">ملاحظة <span className="text-slate-400">اختيارية</span></Label><Textarea id="notes" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="التركيز، الكمية، أو ملاحظة العميل" /></div>
          <Button className="h-11 w-full bg-teal-700 hover:bg-teal-800" disabled={addItem.isPending}>{addItem.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}إضافة إلى قائمة اليوم</Button>
        </div>
      </form> : <section className="panel h-fit"><div className="panel-heading"><span className="icon-surface"><PackagePlus className="h-5 w-5" /></span><div><h2>الإضافة مقيدة</h2><p>يمكن للمشرف تفعيل صلاحية إضافة النواقص لحسابك من المستخدمين.</p></div></div></section>}
      <div className="space-y-5">
        <section className="panel">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="panel-heading"><span className="icon-surface"><ClipboardList className="h-5 w-5" /></span><div><h2>القائمة المفتوحة</h2><p>{openItems.length ? "الأصناف التي ما زالت بانتظار الوصول." : "لا توجد نواقص مفتوحة حاليًا."}</p></div></div></div>
          {openItems.length > 0 && <><ul className="mt-5 space-y-3">{openItems.map(item => renderItem(item))}</ul>{canPrepare && <><div className="mt-5 rounded-xl bg-teal-50 p-3 sm:flex sm:items-center sm:gap-3"><Select value={orderSupplierId} onValueChange={setOrderSupplierId}><SelectTrigger className="bg-white sm:w-56"><SelectValue placeholder="اختر مخزنًا للإرسال" /></SelectTrigger><SelectContent>{activeSuppliers.map(supplier => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select><Button onClick={sendReview} disabled={!orderSupplierId || selected.length === 0 || prepareOrder.isPending} className="mt-2 h-10 w-full bg-teal-700 hover:bg-teal-800 sm:mt-0 sm:w-auto"><MessageCircleMore className="ml-2 h-4 w-4" />إرسال واتساب ({selected.length})</Button></div><p className="mt-2 text-xs text-slate-500">يُفتح واتساب برسالة جاهزة للمراجعة؛ لا تُرسل أي رسالة تلقائيًا.</p></>}</>}
        </section>
        <section className="panel"><div className="panel-heading"><span className="icon-surface bg-emerald-50 text-emerald-700"><Check className="h-5 w-5" /></span><div><h2>وصل اليوم</h2><p>{receivedItems.length ? "أصناف أُكد وصولها اليوم." : "لم يُعلَّم أي صنف كمستلم بعد."}</p></div></div>{receivedItems.length > 0 && <ul className="mt-5 space-y-3">{receivedItems.map(item => renderItem(item, true))}</ul>}</section>
      </div>
    </section>
  </div>;
}
