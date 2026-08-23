import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";

describe("auth.logout", () => {
  it("clears the local session cookie and reports success", async () => {
    const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} },
      res: { clearCookie: (name: string, options: Record<string, unknown>) => cleared.push({ name, options }) },
    } as any);
    expect(await caller.auth.logout()).toEqual({ success: true });
    expect(cleared[0]?.name).toBe(COOKIE_NAME);
    expect(cleared[0]?.options).toMatchObject({ maxAge: -1, httpOnly: true, path: "/" });
  });
});
