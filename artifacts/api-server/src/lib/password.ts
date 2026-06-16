import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * PIN/password hashing using Node's built-in scrypt (no extra dependency).
 *
 * scrypt is a memory-hard KDF suitable for low-entropy secrets like 4-digit
 * PINs. Each hash uses a fresh 16-byte salt; the salt and parameters are stored
 * alongside the digest so verification is self-describing:
 *
 *   scrypt$<N>$<saltHex>$<hashHex>
 *
 * Comparison is constant-time via timingSafeEqual.
 */

const KEYLEN = 64;
const COST = 16384; // scrypt N (CPU/memory cost)
const SALT_BYTES = 16;

export function hashPin(pin: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(pin, salt, KEYLEN, { N: COST });
  return `scrypt$${COST}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  if (!Number.isFinite(cost) || salt.length === 0 || expected.length === 0) return false;
  let derived: Buffer;
  try {
    derived = scryptSync(pin, salt, expected.length, { N: cost });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
