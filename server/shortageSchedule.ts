import type { Request, Response } from "express";
import { getRolloverSettingsByTaskUid, rolloverOpenShortages } from "./db";
import { isCairoMidnight } from "./shortagesDomain";
import { sdk } from "./_core/sdk";

export async function handleShortageRollover(req: Request, res: Response) {
  try {
    const cronUser = await sdk.authenticateRequest(req);
    if (!cronUser.isCron || !cronUser.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const settings = await getRolloverSettingsByTaskUid(cronUser.taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    if (!settings.enabled) return res.json({ ok: true, skipped: "disabled" });
    if (!isCairoMidnight()) return res.json({ ok: true, skipped: "outside-cairo-midnight" });

    const result = await rolloverOpenShortages();
    return res.json({ ok: true, ...result });
  } catch (error) {
    const safeError = error instanceof Error ? error.message : "unknown-error";
    return res.status(500).json({
      error: safeError,
      context: { path: req.path },
      timestamp: new Date().toISOString(),
    });
  }
}
