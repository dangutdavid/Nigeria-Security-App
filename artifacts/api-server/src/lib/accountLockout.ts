import { ephemeralDelete, ephemeralGet, ephemeralSet } from "./ephemeralStore";
import { envInt } from "./rateLimit";

/**
 * Per-account lockout. The login rate limit is per IP; a 4-digit PIN has only
 * 10,000 combinations, so an attacker rotating IPs could still walk one badge.
 * After LOCKOUT_THRESHOLD consecutive failures for a badge, that badge is
 * locked for LOCKOUT_MINUTES regardless of source IP.
 *
 * Applied to unknown badges too, so a lock never reveals whether an account
 * exists (no user enumeration). Shared across instances via Redis.
 */
const threshold = () => envInt("LOCKOUT_THRESHOLD", 10);
const lockMs = () => envInt("LOCKOUT_MINUTES", 15) * 60 * 1000;

const key = (badge: string) => badge.trim().toUpperCase();

export async function isLockedOut(badge: string): Promise<boolean> {
  return (await ephemeralGet(`lock:${key(badge)}`)) !== null;
}

/** Record a failed attempt; returns true if this failure triggered a lock. */
export async function recordLoginFailure(badge: string): Promise<boolean> {
  const k = key(badge);
  const count = Number((await ephemeralGet(`authfail:${k}`)) ?? 0) + 1;
  if (count >= threshold()) {
    await ephemeralSet(`lock:${k}`, "1", lockMs());
    await ephemeralDelete(`authfail:${k}`);
    return true;
  }
  await ephemeralSet(`authfail:${k}`, String(count), lockMs());
  return false;
}

export async function clearLoginFailures(badge: string): Promise<void> {
  await ephemeralDelete(`authfail:${key(badge)}`);
}

export function lockoutMinutes(): number {
  return Math.round(lockMs() / 60000);
}
