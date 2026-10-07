import { getRedis } from "./redis";
import { logger } from "./logger";

/**
 * Short-lived key/value state (one-time codes, used challenge ids). Redis when
 * REDIS_URL is set so it works across N API instances; an in-process map
 * otherwise (single-instance/dev). Values never outlive their TTL.
 */
const memory = new Map<string, { value: string; expiresAt: number }>();

/**
 * Run against Redis, falling back to the in-process map if Redis is down or
 * still connecting — a cache outage degrades to single-instance behaviour
 * instead of failing logins and 2FA.
 */
async function viaRedis<T>(op: (redis: NonNullable<ReturnType<typeof getRedis>>) => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return fallback();
  try {
    return await op(redis);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Redis unavailable — using in-process ephemeral store");
    return fallback();
  }
}

function sweep(now: number): void {
  if (memory.size < 5_000) return;
  for (const [k, v] of memory) if (v.expiresAt <= now) memory.delete(k);
}

function memSet(key: string, value: string, ttlMs: number): void {
  sweep(Date.now());
  memory.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function memGet(key: string): string | null {
  const hit = memory.get(key);
  if (!hit || hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

export function ephemeralSet(key: string, value: string, ttlMs: number): Promise<void> {
  return viaRedis(
    async (r) => void (await r.set(`eph:${key}`, value, "PX", ttlMs)),
    () => memSet(key, value, ttlMs),
  );
}

export function ephemeralGet(key: string): Promise<string | null> {
  return viaRedis((r) => r.get(`eph:${key}`), () => memGet(key));
}

export function ephemeralDelete(key: string): Promise<void> {
  return viaRedis(
    async (r) => void (await r.del(`eph:${key}`)),
    () => void memory.delete(key),
  );
}

/** Atomically claim a key once (e.g. a single-use challenge). True if claimed. */
export function ephemeralClaimOnce(key: string, ttlMs: number): Promise<boolean> {
  return viaRedis(
    async (r) => (await r.set(`eph:${key}`, "1", "PX", ttlMs, "NX")) === "OK",
    () => {
      if (memGet(key) !== null) return false;
      memSet(key, "1", ttlMs);
      return true;
    },
  );
}
