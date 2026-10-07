import { getRedis } from "./redis";

/**
 * Short-lived key/value state (one-time codes, used challenge ids). Redis when
 * REDIS_URL is set so it works across N API instances; an in-process map
 * otherwise (single-instance/dev). Values never outlive their TTL.
 */
const memory = new Map<string, { value: string; expiresAt: number }>();

function sweep(now: number): void {
  if (memory.size < 5_000) return;
  for (const [k, v] of memory) if (v.expiresAt <= now) memory.delete(k);
}

export async function ephemeralSet(key: string, value: string, ttlMs: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(`eph:${key}`, value, "PX", ttlMs);
    return;
  }
  sweep(Date.now());
  memory.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function ephemeralGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) return redis.get(`eph:${key}`);
  const hit = memory.get(key);
  if (!hit || hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

export async function ephemeralDelete(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(`eph:${key}`);
    return;
  }
  memory.delete(key);
}

/** Atomically claim a key once (e.g. a single-use challenge). True if claimed. */
export async function ephemeralClaimOnce(key: string, ttlMs: number): Promise<boolean> {
  const redis = getRedis();
  if (redis) return (await redis.set(`eph:${key}`, "1", "PX", ttlMs, "NX")) === "OK";
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && hit.expiresAt > now) return false;
  memory.set(key, { value: "1", expiresAt: now + ttlMs });
  return true;
}
