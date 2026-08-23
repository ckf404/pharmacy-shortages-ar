export type ShortagePriority = "normal" | "important" | "urgent";

export type WhatsAppItem = {
  productName: string;
  priority: ShortagePriority;
  notes?: string | null;
};

export type RolloverSource = { id: number; status: string };

export function selectRolloverCandidates<T extends RolloverSource>(items: T[], existingSourceIds: Iterable<number | null>) {
  const alreadyCopied = new Set(Array.from(existingSourceIds).filter((id): id is number => typeof id === "number"));
  return items.filter(item => item.status === "open" && !alreadyCopied.has(item.id));
}

const cairoParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
};

export function cairoDayKey(date = new Date()) {
  const parts = cairoParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isCairoMidnight(date = new Date()) {
  const parts = cairoParts(date);
  return parts.hour === "00" && parts.minute === "00";
}

export function previousDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

export function priorityLabel(priority: ShortagePriority) {
  return {
    normal: "عادي",
    important: "مهم",
    urgent: "عاجل للعميل",
  }[priority];
}

export function normalizeEgyptianWhatsApp(input: string) {
  const digits = input.replace(/\D/g, "");
  const normalized = digits.startsWith("00") ? digits.slice(2) : digits;

  if (/^20(10|11|12|15)\d{8}$/.test(normalized)) return normalized;
  if (/^0(10|11|12|15)\d{8}$/.test(normalized)) return `20${normalized.slice(1)}`;
  if (/^(10|11|12|15)\d{8}$/.test(normalized)) return `20${normalized}`;

  throw new Error("رقم واتساب المصري غير صالح. استخدم 010… أو +20…");
}

export function buildWhatsAppMessage(input: {
  dayKey: string;
  supplierName: string;
  items: WhatsAppItem[];
}) {
  const lines = [
    `طلب نواقص الصيدلية — ${input.dayKey}`,
    `المخزن: ${input.supplierName}`,
    "",
    "الأصناف المطلوبة:",
    ...input.items.map((item, index) => {
      const note = item.notes?.trim() ? ` (${item.notes.trim()})` : "";
      return `${index + 1}. ${item.productName} — ${priorityLabel(item.priority)}${note}`;
    }),
    "",
    "برجاء تأكيد التوفر وموعد التسليم. شكرًا.",
  ];

  return lines.join("\n");
}

export function whatsappUrl(normalizedPhone: string, message: string) {
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
