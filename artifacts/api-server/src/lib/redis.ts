import { Redis } from "ioredis";
import { logger } from "./logger";

/**
 * Shared Redis connection (roadmap Phase 4.2 / E2). This is the one code
 * change that unlocks N > 1 API instances: rate-limit counters and token
 * revocation move from per-process Maps to a store all instances share.
 *
 * Activated by REDIS_URL (e.g. redis://:password@host:6379/0). Without it,
 * everything falls back to the in-process implementations — correct for a
 * single instance, unchanged for local dev and tests.
 *
 * Failure posture: Redis being down must never take the API down. Callers
 * treat errors as "shared store unavailable" and fall back to their local
 * path; ioredis reconnects in the background.
 */
let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env["REDIS_URL"];
  if (!url) {
    client = null;
    return client;
  }
  client = new Redis(url, {
    // Fail fast per-command instead of queueing forever when Redis is down —
    // callers fall back to their in-process path.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    // ioredis emits repeatedly while reconnecting; log at debug cadence.
    logger.debug({ err: err.message }, "Redis connection error (falling back to in-process stores)");
  });
  client.on("ready", () => {
    logger.info("Redis connected — shared rate limits and token revocation active");
  });
  logger.info("Redis configured via REDIS_URL");
  return client;
}

/** Test hook: reset the memoized client so a fresh env is re-read. */
export function resetRedisForTests(): void {
  client?.disconnect();
  client = undefined;
}
