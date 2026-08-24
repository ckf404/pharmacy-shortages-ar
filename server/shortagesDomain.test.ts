import { describe, expect, it } from "vitest";
import {
  buildWhatsAppMessage,
  cairoDayKey,
  decideArchivedTransfer,
  isCairoMidnight,
  normalizeEgyptianWhatsApp,
  previousDayKey,
  selectRolloverCandidates,
  whatsappUrl,
} from "./shortagesDomain";

describe("shortages domain", () => {
  it("uses Cairo's local calendar date", () => {
    expect(cairoDayKey(new Date("2026-08-22T22:30:00.000Z"))).toBe("2026-08-23");
    expect(previousDayKey("2026-03-01")).toBe("2026-02-28");
  });

  it("identifies only the exact Cairo midnight minute", () => {
    expect(isCairoMidnight(new Date("2026-08-22T21:00:00.000Z"))).toBe(true);
    expect(isCairoMidnight(new Date("2026-08-22T21:01:00.000Z"))).toBe(false);
  });

  it("normalizes common Egyptian WhatsApp formats", () => {
    expect(normalizeEgyptianWhatsApp("01012345678")).toBe("201012345678");
    expect(normalizeEgyptianWhatsApp("+20 1012345678")).toBe("201012345678");
  });

  it("creates a review-ready Arabic WhatsApp request", () => {
    const message = buildWhatsAppMessage({
      dayKey: "2026-08-23",
      supplierName: "مخزن النور",
      items: [{ productName: "أوجمنتين 1 جم", dosageForm: "أقراص", quantity: 2, priority: "urgent", notes: "علبة واحدة" }],
      settings: { pharmacyName: "صيدلية فارس", supplierMessageIntro: "طلب {pharmacyName} بتاريخ {date}", supplierMessageFooter: "في الانتظار" },
    });
    expect(message).toContain("طلب صيدلية فارس بتاريخ 2026-08-23");
    expect(message).toContain("1. أوجمنتين 1 جم — أقراص × 2");
    expect(message).not.toContain("— مهم");
    expect(message).not.toContain("علبة واحدة");
    expect(message).toContain("في الانتظار");
    expect(whatsappUrl("201012345678", message)).toContain("https://wa.me/201012345678?text=");
  });

  it("selects every active non-received shortage and remains safe when a previous run already copied items", () => {
    const sources = [
      { id: 11, status: "open" },
      { id: 12, status: "received" },
      { id: 13, status: "deleted" },
      { id: 14, status: "open" },
      { id: 15, status: "awaiting_supplier" },
    ];
    expect(selectRolloverCandidates(sources, [14])).toEqual([{ id: 11, status: "open" }, { id: 15, status: "awaiting_supplier" }]);
    expect(selectRolloverCandidates(sources, [11, 14, 15])).toEqual([]);
  });

  it("keeps received items in their original dated invoice instead of rolling them into a new one", () => {
    const previousInvoice = [
      { id: 21, status: "open" },
      { id: 22, status: "received" },
    ];
    expect(selectRolloverCandidates(previousInvoice, [])).toEqual([{ id: 21, status: "open" }]);
  });

  it("keeps every open item eligible for carry-forward even when older days exist", () => {
    const skippedDays = [{ id: 31, status: "open" }, { id: 32, status: "received" }];
    expect(selectRolloverCandidates(skippedDays, [])).toEqual([{ id: 31, status: "open" }]);
  });

  it("does not treat received archived items as candidates for automatic carry-forward", () => {
    expect(selectRolloverCandidates([{ id: 40, status: "received" }], [])).toEqual([]);
  });

  it("chooses a duplicate, restoration, or creation action for manual archived transfers", () => {
    expect(decideArchivedTransfer(9, 7)).toEqual({ action: "existing", itemId: 9 });
    expect(decideArchivedTransfer(undefined, 7)).toEqual({ action: "restore", itemId: 7 });
    expect(decideArchivedTransfer()).toEqual({ action: "create", itemId: null });
  });
});
