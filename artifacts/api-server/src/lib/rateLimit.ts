import type { NextFunction, Request, Response } from "express";
import { rateLimitRejections } from "./metrics";

/**
 * Small fixed-window in-process rate limiter. Per-instance by design — behind
 * a load balancer each instance enforces its own window, which still bounds
 * abuse; move to a shared store (Redis) if hard global limits are required.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests per window per key. */
  max: number;
  /** Derive the bucket key; defaults to client IP. */
  keyFor?: (req: Request) => string;
  /** Message returned with the 429. */
  message?: string;
  /** Label for the rate_limit_rejections_total metric. */
  name?: string;
}

export function rateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, WindowEntry>();
  const keyFor = options.keyFor ?? ((req: Request) => req.ip ?? "unknown");

  // Opportunistic sweep so the map doesn't grow unbounded.
  function sweep(now: number) {
    if (buckets.size < 10_000) return;
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(key);
    }
  }

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    sweep(now);
    const key = keyFor(req);
    const entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > options.max) {
      rateLimitRejections.inc({ limiter: options.name ?? "unnamed" });
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000).toString());
      res.status(429).json({
        error: options.message ?? "Too many requests. Please try again later.",
      });
      return;
    }
    next();
  };
}
