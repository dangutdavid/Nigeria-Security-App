import type { NextFunction, Request, Response } from "express";
import { rateLimitRejections } from "./metrics";
import { getRedis } from "./redis";
import { logger } from "./logger";

/**
 * Fixed-window rate limiter with two backends:
 *
 *  - Redis (REDIS_URL set): counters shared across all API instances, so the
 *    limit is a hard global limit — the configuration production needs (E2).
 *  - In-process Map (default): per-instance windows, correct for a single
 *    instance and for local dev/tests.
 *
 * Failure posture: if Redis errors mid-request the limiter falls back to the
 * local window for that request — the API never 500s because the shared store
 * blinked, and a local bound still applies while Redis reconnects.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

interface WindowHit {
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
  /** Label for the rate_limit_rejections_total metric; also namespaces Redis keys. */
  name?: string;
}

// Atomic INCR + set-expiry-on-first-hit + read-ttl. One round trip per request.
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

export function rateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, WindowEntry>();
  const keyFor = options.keyFor ?? ((req: Request) => req.ip ?? "unknown");
  const limiterName = options.name ?? "unnamed";

  // Opportunistic sweep so the map doesn't grow unbounded.
  function sweep(now: number) {
    if (buckets.size < 10_000) return;
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(key);
    }
  }

  function hitLocal(key: string, now: number): WindowHit {
    sweep(now);
    const entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + options.windowMs };
      buckets.set(key, fresh);
      return fresh;
    }
    entry.count += 1;
    return entry;
  }

  async function hitShared(key: string, now: number): Promise<WindowHit | null> {
    const redis = getRedis();
    if (!redis || redis.status !== "ready") return null;
    try {
      const result = (await redis.eval(
        HIT_SCRIPT,
        1,
        `ratelimit:${limiterName}:${key}`,
        String(options.windowMs),
      )) as [number, number];
      const [count, ttl] = result;
      return { count, resetAt: now + (ttl > 0 ? ttl : options.windowMs) };
    } catch (err) {
      logger.debug({ err, limiter: limiterName }, "Redis rate-limit hit failed — using local window");
      return null;
    }
  }

  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const now = Date.now();
    const key = keyFor(req);
    const hit = (await hitShared(key, now)) ?? hitLocal(key, now);

    if (hit.count > options.max) {
      rateLimitRejections.inc({ limiter: limiterName });
      res.setHeader("Retry-After", Math.max(1, Math.ceil((hit.resetAt - now) / 1000)).toString());
      res.status(429).json({
        error: options.message ?? "Too many requests. Please try again later.",
      });
      return;
    }
    next();
  };
}
