import { describe, expect, it } from "vitest";
import { achievementLevel } from "./profile";

describe("achievement levels", () => {
  it("calculates points from every recorded shortage action passed to it", () => {
    expect(achievementLevel(2, 3, 1)).toMatchObject({ points: 18, level: 2, levelName: "متابع نشط" });
  });

  it("does not reduce a user's logged-shortage credit when that item later changes status", () => {
    const beforeReceipt = achievementLevel(4, 0, 0);
    const afterReceipt = achievementLevel(4, 1, 0);
    expect(afterReceipt.added).toBe(beforeReceipt.added);
    expect(afterReceipt.points).toBeGreaterThan(beforeReceipt.points);
  });

  it("reports the next target until the top level", () => {
    expect(achievementLevel(0, 0, 0).nextLevelAt).toBe(15);
    expect(achievementLevel(80, 0, 0).nextLevelAt).toBeNull();
  });
});
