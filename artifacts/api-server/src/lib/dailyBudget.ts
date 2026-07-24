import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

/**
 * Server-wide daily call budget. The per-IP rate limiter bounds a single
 * abuser; this bounds *aggregate* cost across all callers (e.g. a botnet with
 * thousands of IPs) so a public, unauthenticated endpoint that proxies paid LLM
 * calls can't run up an unbounded bill.
 *
 * In-process and per-instance by design (like rateLimit.ts): behind N instances
 * the effective budget is N × max. That still converts an unbounded spend into
 * a bounded, known ceiling. Move the counter to Redis (see ARCHITECTURE.md §9)
 * if a hard global cap is required.
 */
export interface DailyBudgetOptions {
  /** Max allowed calls per UTC day. */
  max: number;
  /** Label used in the 503 message and logs. */
  name: string;
}

export function dailyBudget(options: DailyBudgetOptions) {
  let dayKey = "";
  let count = 0;

  function currentDayKey(now: number): string {
    // UTC calendar day — avoids DST and keeps instances aligned.
    return new Date(now).toISOString().slice(0, 10);
  }

  return function dailyBudgetMiddleware(_req: Request, res: Response, next: NextFunction): void {
    const today = currentDayKey(Date.now());
    if (today !== dayKey) {
      dayKey = today;
      count = 0;
    }
    if (count >= options.max) {
      logger.warn({ budget: options.name, max: options.max, day: dayKey }, "Daily budget exhausted");
      res.setHeader("Retry-After", "3600");
      res.status(503).json({
        error: `The ${options.name} has reached today's usage limit. Please try again tomorrow.`,
        code: "daily_budget_exhausted",
      });
      return;
    }
    count += 1;
    next();
  };
}
