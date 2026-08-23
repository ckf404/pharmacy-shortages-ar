import { describe, expect, it } from "vitest";
import {
  buildWhatsAppMessage,
  cairoDayKey,
  isCairoMidnight,
  normalizeEgyptianWhatsApp,
  previousDayKey,
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
      items: [{ productName: "أوجمنتين 1 جم", priority: "urgent", notes: "علبة واحدة" }],
    });
    expect(message).toContain("1. أوجمنتين 1 جم — عاجل للعميل (علبة واحدة)");
    expect(whatsappUrl("201012345678", message)).toContain("https://wa.me/201012345678?text=");
  });
});
