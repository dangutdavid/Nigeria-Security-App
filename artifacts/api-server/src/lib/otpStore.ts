import { createHash, randomInt } from "node:crypto";

/**
 * Short-lived OTP codes for self-service PIN reset. Kept in memory on purpose:
 * codes expire after 10 minutes, so the worst case of a restart is voiding
 * pending codes (the user simply requests a new one). Only code hashes are
 * kept — never the code itself.
 */

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_GRANT_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface PendingOtp {
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

const pendingByBadge = new Map<string, PendingOtp>();
/** Badges whose OTP was verified recently — allowed to reset their PIN once. */
const resetGrants = new Map<string, number>();

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function normalize(badge: string): string {
  return badge.trim().toUpperCase();
}

export function issueOtp(badgeNumber: string): string {
  const code = randomInt(100000, 1000000).toString();
  pendingByBadge.set(normalize(badgeNumber), {
    codeHash: hashCode(code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  return code;
}

export type OtpVerification = "ok" | "invalid" | "expired";

export function verifyOtp(badgeNumber: string, code: string): OtpVerification {
  const badge = normalize(badgeNumber);
  const pending = pendingByBadge.get(badge);
  if (!pending) return "invalid";
  if (pending.expiresAt < Date.now()) {
    pendingByBadge.delete(badge);
    return "expired";
  }
  pending.attempts += 1;
  if (pending.attempts > MAX_ATTEMPTS) {
    pendingByBadge.delete(badge);
    return "invalid";
  }
  if (pending.codeHash !== hashCode(code.trim())) return "invalid";
  pendingByBadge.delete(badge);
  resetGrants.set(badge, Date.now() + RESET_GRANT_TTL_MS);
  return "ok";
}

/** Consume the one-shot PIN-reset grant created by a successful OTP verify. */
export function consumeResetGrant(badgeNumber: string): boolean {
  const badge = normalize(badgeNumber);
  const until = resetGrants.get(badge);
  if (!until || until < Date.now()) {
    resetGrants.delete(badge);
    return false;
  }
  resetGrants.delete(badge);
  return true;
}
