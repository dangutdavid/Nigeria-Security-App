import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { logger } from "./logger";

/**
 * Application-level field encryption (AES-256-GCM) for secrets and sensitive
 * identifiers at rest — authenticator seeds, phone numbers. Defence in depth on
 * top of disk/volume encryption: a database dump or backup alone does not
 * reveal them (HIPAA §164.312(a)(2)(iv), GDPR Art. 32, NDPA s.39).
 *
 * Key: DATA_ENCRYPTION_KEY = 32 random bytes, base64. Rotation: set the new key
 * as DATA_ENCRYPTION_KEY and the old one as DATA_ENCRYPTION_KEY_PREVIOUS;
 * decryption tries both, encryption uses the current key only.
 *
 * Ciphertext format: enc:v1:<iv>:<tag>:<ciphertext> (base64url parts).
 */
const PREFIX = "enc:v1:";

function parseKey(raw: string | undefined, name: string): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded (got ${key.length}).`);
  return key;
}

const keys: Buffer[] = (() => {
  const current = parseKey(process.env.DATA_ENCRYPTION_KEY, "DATA_ENCRYPTION_KEY");
  const previous = parseKey(process.env.DATA_ENCRYPTION_KEY_PREVIOUS, "DATA_ENCRYPTION_KEY_PREVIOUS");
  if (current) return previous ? [current, previous] : [current];
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATA_ENCRYPTION_KEY must be set in production (32 random bytes, base64).");
  }
  logger.warn("DATA_ENCRYPTION_KEY is not set — deriving a development key. Never use this in production.");
  const seed = process.env.AUTH_SECRET ?? "dev-insecure-auth-secret-change-me";
  return [Buffer.from(hkdfSync("sha256", seed, "nsa-field-crypto", "dev-data-key", 32))];
})();

export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys[0]!, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ct.toString("base64url")}`;
}

export function decryptField(value: string): string {
  if (!value.startsWith(PREFIX)) throw new Error("Value is not an encrypted field.");
  const [ivB, tagB, ctB] = value.slice(PREFIX.length).split(":");
  if (!ivB || !tagB || ctB === undefined) throw new Error("Malformed encrypted field.");
  for (const key of keys) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
      decipher.setAuthTag(Buffer.from(tagB, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]).toString("utf8");
    } catch {
      // try the next (previous) key
    }
  }
  throw new Error("Encrypted field could not be decrypted with any configured key.");
}

/** Show only the last digits of a phone number, e.g. +234 *** *** 4521. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length <= 4 ? "****" : `${phone.trim().startsWith("+") ? "+" : ""}${"*".repeat(Math.max(digits.length - 4, 3))}${digits.slice(-4)}`;
}
