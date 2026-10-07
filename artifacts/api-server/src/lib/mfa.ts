import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { runAsSystem } from "@workspace/db";
import type { AuthUser, Role } from "./auth";
import { signPayload, verifyPayloadSignature } from "./auth";
import { decryptField, encryptField, maskPhone } from "./fieldCrypto";
import { ephemeralClaimOnce, ephemeralDelete, ephemeralGet, ephemeralSet } from "./ephemeralStore";
import { mfaStore, type MfaRecord } from "./mfaStore";
import { normalizePhone, sendSms } from "./sms";
import { base32Encode, generateTotpSecret, otpauthUri, verifyTotp } from "./totp";

/**
 * Two-factor authentication: authenticator app (TOTP), SMS one-time code, and
 * single-use recovery codes.
 *
 * Login with MFA enrolled:  PIN ok → { mfaRequired, challengeToken } (no
 * session yet) → POST /auth/mfa/verify with a code → session token whose
 * amr = ["pin", "otp"|"sms"|"recovery"].
 *
 * Enforcement: roles listed in MFA_ENFORCED_ROLES must have a second factor.
 * Default in production: every staff role. Default elsewhere: none (demo logins
 * keep working); anyone may opt in. A user whose role requires MFA but who has
 * not enrolled gets a restricted "mfa_enroll" session that can only enrol.
 */
export type MfaMethod = "totp" | "sms" | "recovery";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SMS_CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 10;

const STAFF_ROLES: Role[] = ["officer", "supervisor", "commander", "admin", "super_admin"];

export function mfaEnforcedRoles(): Set<string> {
  const raw = process.env.MFA_ENFORCED_ROLES;
  if (raw !== undefined) return new Set(raw.split(",").map((r) => r.trim()).filter(Boolean));
  return new Set(process.env.NODE_ENV === "production" ? STAFF_ROLES : []);
}

export function isMfaRequiredForRole(role: string): boolean {
  return mfaEnforcedRoles().has(role);
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

function safeEqualHex(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ---- status ---------------------------------------------------------------------

export interface MfaStatus {
  totpEnabled: boolean;
  smsEnabled: boolean;
  smsMaskedPhone: string | null;
  recoveryCodesRemaining: number;
  required: boolean;
  enrolled: boolean;
}

function statusOf(record: MfaRecord | null, role: string): MfaStatus {
  const phone = record?.smsEnabled && record.smsPhoneEnc ? decryptField(record.smsPhoneEnc) : null;
  const enrolled = Boolean(record?.totpEnabled || record?.smsEnabled);
  return {
    totpEnabled: Boolean(record?.totpEnabled),
    smsEnabled: Boolean(record?.smsEnabled),
    smsMaskedPhone: phone ? maskPhone(phone) : null,
    recoveryCodesRemaining: record?.recoveryCodeHashes.length ?? 0,
    required: isMfaRequiredForRole(role),
    enrolled,
  };
}

export async function getMfaStatus(userId: string, role: string): Promise<MfaStatus> {
  return statusOf(await mfaStore.get(userId), role);
}

/** Pre-session check at login (PRIVILEGE BOUNDARY: runs as system). */
export function getMfaStatusForLogin(userId: string, role: string): Promise<MfaStatus> {
  return runAsSystem(() => getMfaStatus(userId, role));
}

// ---- login challenge ---------------------------------------------------------------

interface ChallengePayload {
  t: "mfa";
  n: string; // nonce — single use
  exp: number;
  u: Pick<AuthUser, "id" | "name" | "badgeNumber" | "agency" | "role">;
  m: MfaMethod[];
}

export function createChallenge(user: AuthUser, status: MfaStatus): { challengeToken: string; methods: MfaMethod[] } {
  const methods: MfaMethod[] = [];
  if (status.totpEnabled) methods.push("totp");
  if (status.smsEnabled) methods.push("sms");
  if (status.recoveryCodesRemaining > 0) methods.push("recovery");
  const payload: ChallengePayload = {
    t: "mfa",
    n: randomBytes(16).toString("base64url"),
    exp: Date.now() + CHALLENGE_TTL_MS,
    u: { id: user.id, name: user.name, badgeNumber: user.badgeNumber, agency: user.agency, role: user.role },
    m: methods,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { challengeToken: `${encoded}.${signPayload(`mfa-challenge:${encoded}`)}`, methods };
}

export function parseChallenge(token: string): ChallengePayload | null {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig || !verifyPayloadSignature(`mfa-challenge:${encoded}`, sig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ChallengePayload;
    if (payload.t !== "mfa" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function recordFailure(key: string): Promise<boolean> {
  const current = Number((await ephemeralGet(`mfa:fail:${key}`)) ?? 0) + 1;
  await ephemeralSet(`mfa:fail:${key}`, String(current), CHALLENGE_TTL_MS);
  return current >= MAX_ATTEMPTS;
}

async function attemptsExhausted(key: string): Promise<boolean> {
  return Number((await ephemeralGet(`mfa:fail:${key}`)) ?? 0) >= MAX_ATTEMPTS;
}

function newSmsCode(): string {
  return randomInt(100000, 1000000).toString();
}

/** Send an SMS code for a login challenge. Returns the code only in development. */
export async function sendChallengeSms(challenge: ChallengePayload): Promise<{ maskedPhone: string; devCode?: string }> {
  const record = await runAsSystem(() => mfaStore.get(challenge.u.id));
  if (!record?.smsEnabled || !record.smsPhoneEnc) throw new MfaError("sms_not_enrolled", "SMS is not enabled for this account.");
  const phone = decryptField(record.smsPhoneEnc);
  const code = newSmsCode();
  await ephemeralSet(`mfa:sms:${challenge.n}`, sha256(code), SMS_CODE_TTL_MS);
  await sendSms(phone, `Your Nigeria Safety & Security sign-in code is ${code}. It expires in 5 minutes. Never share it.`);
  return { maskedPhone: maskPhone(phone), ...(devCodesAllowed() ? { devCode: code } : {}) };
}

export class MfaError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function devCodesAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && (process.env.SMS_PROVIDER ?? "log") === "log";
}

/**
 * Verify a login challenge. On success the challenge is consumed (single use)
 * and the authenticated user is returned for session minting.
 */
export async function verifyChallenge(token: string, method: MfaMethod, code: string): Promise<{ user: ChallengePayload["u"]; method: MfaMethod }> {
  const challenge = parseChallenge(token);
  if (!challenge) throw new MfaError("challenge_invalid", "This sign-in attempt has expired. Please sign in again.");
  if (!challenge.m.includes(method)) throw new MfaError("method_unavailable", "That verification method is not enabled for this account.");
  if (await attemptsExhausted(challenge.n)) throw new MfaError("too_many_attempts", "Too many incorrect codes. Please sign in again.");

  const ok = await runAsSystem(() => checkFactor(challenge.u.id, method, code, `mfa:sms:${challenge.n}`));
  if (!ok) {
    const locked = await recordFailure(challenge.n);
    throw new MfaError(locked ? "too_many_attempts" : "code_invalid", locked ? "Too many incorrect codes. Please sign in again." : "That code is not correct.");
  }
  if (!(await ephemeralClaimOnce(`mfa:used:${challenge.n}`, CHALLENGE_TTL_MS))) {
    throw new MfaError("challenge_invalid", "This sign-in attempt was already used. Please sign in again.");
  }
  await ephemeralDelete(`mfa:sms:${challenge.n}`);
  return { user: challenge.u, method };
}

/** Check one factor for a user; consumes recovery codes and records TOTP steps. */
async function checkFactor(userId: string, method: MfaMethod, code: string, smsKey: string): Promise<boolean> {
  const record = await mfaStore.get(userId);
  if (!record) return false;
  if (method === "totp") {
    if (!record.totpEnabled || !record.totpSecretEnc) return false;
    const step = verifyTotp(decryptField(record.totpSecretEnc), code, { lastUsedStep: record.totpLastStep });
    if (step === null) return false;
    await mfaStore.upsert(userId, { totpLastStep: step }); // replay protection
    return true;
  }
  if (method === "sms") {
    const expected = await ephemeralGet(smsKey);
    return Boolean(expected && /^\d{6}$/.test(code.trim()) && safeEqualHex(expected, sha256(code.trim())));
  }
  const hash = sha256(normalizeRecoveryCode(code));
  const remaining = record.recoveryCodeHashes.filter((h) => !safeEqualHex(h, hash));
  if (remaining.length === record.recoveryCodeHashes.length) return false;
  await mfaStore.upsert(userId, { recoveryCodeHashes: remaining }); // single use
  return true;
}

// ---- enrolment (authenticated user acting on their own account) ----------------

function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = base32Encode(randomBytes(5)).slice(0, 8);
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
  return { codes, hashes: codes.map((c) => sha256(normalizeRecoveryCode(c))) };
}

export async function beginTotpEnrolment(user: Pick<AuthUser, "id" | "badgeNumber">): Promise<{ secret: string; otpauthUri: string }> {
  const secret = generateTotpSecret();
  await mfaStore.upsert(user.id, { totpPendingSecretEnc: encryptField(secret) });
  return { secret, otpauthUri: otpauthUri(secret, user.badgeNumber) };
}

/** Confirm with a code from the app; returns fresh recovery codes if none existed. */
export async function confirmTotpEnrolment(userId: string, code: string): Promise<{ recoveryCodes?: string[] }> {
  const record = await mfaStore.get(userId);
  if (!record?.totpPendingSecretEnc) throw new MfaError("no_pending_enrolment", "Start authenticator setup first.");
  const secret = decryptField(record.totpPendingSecretEnc);
  const step = verifyTotp(secret, code);
  if (step === null) throw new MfaError("code_invalid", "That code is not correct. Check the time on your phone and try again.");
  const recovery = record.recoveryCodeHashes.length === 0 ? generateRecoveryCodes() : null;
  await mfaStore.upsert(userId, {
    totpSecretEnc: record.totpPendingSecretEnc,
    totpPendingSecretEnc: null,
    totpEnabled: true,
    totpLastStep: step,
    enrolledAt: record.enrolledAt ?? new Date(),
    ...(recovery ? { recoveryCodeHashes: recovery.hashes } : {}),
  });
  return recovery ? { recoveryCodes: recovery.codes } : {};
}

export async function beginSmsEnrolment(userId: string, rawPhone: string): Promise<{ maskedPhone: string; devCode?: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new MfaError("phone_invalid", "Enter a valid phone number, e.g. +2348012345678 or 08012345678.");
  const code = newSmsCode();
  await mfaStore.upsert(userId, { smsPendingPhoneEnc: encryptField(phone) });
  await ephemeralSet(`mfa:smsenrol:${userId}`, sha256(code), SMS_CODE_TTL_MS);
  await sendSms(phone, `Your Nigeria Safety & Security verification code is ${code}. It expires in 5 minutes.`);
  return { maskedPhone: maskPhone(phone), ...(devCodesAllowed() ? { devCode: code } : {}) };
}

export async function confirmSmsEnrolment(userId: string, code: string): Promise<{ recoveryCodes?: string[] }> {
  const record = await mfaStore.get(userId);
  const expected = await ephemeralGet(`mfa:smsenrol:${userId}`);
  if (!record?.smsPendingPhoneEnc || !expected) throw new MfaError("no_pending_enrolment", "Request a new code first.");
  if (await attemptsExhausted(`enrol:${userId}`)) throw new MfaError("too_many_attempts", "Too many incorrect codes. Request a new code.");
  if (!/^\d{6}$/.test(code.trim()) || !safeEqualHex(expected, sha256(code.trim()))) {
    await recordFailure(`enrol:${userId}`);
    throw new MfaError("code_invalid", "That code is not correct.");
  }
  const recovery = record.recoveryCodeHashes.length === 0 ? generateRecoveryCodes() : null;
  await mfaStore.upsert(userId, {
    smsPhoneEnc: record.smsPendingPhoneEnc,
    smsPendingPhoneEnc: null,
    smsEnabled: true,
    enrolledAt: record.enrolledAt ?? new Date(),
    ...(recovery ? { recoveryCodeHashes: recovery.hashes } : {}),
  });
  await ephemeralDelete(`mfa:smsenrol:${userId}`);
  return recovery ? { recoveryCodes: recovery.codes } : {};
}

/** Disabling a factor requires a current TOTP or recovery code (step-up). */
export async function disableFactor(userId: string, role: string, method: "totp" | "sms", proof: { method: MfaMethod; code: string }): Promise<MfaStatus> {
  if (!(await checkFactor(userId, proof.method, proof.code, `mfa:none:${userId}`))) {
    throw new MfaError("code_invalid", "Confirm with a current authenticator or recovery code.");
  }
  const record = await mfaStore.get(userId);
  const patch = method === "totp" ? { totpEnabled: false, totpSecretEnc: null, totpLastStep: null } : { smsEnabled: false, smsPhoneEnc: null };
  const next = await mfaStore.upsert(userId, patch);
  if (isMfaRequiredForRole(role) && !next.totpEnabled && !next.smsEnabled) {
    await mfaStore.upsert(userId, record ?? {}); // restore — can't remove the last factor of a mandatory role
    throw new MfaError("factor_required", "Your role requires two-factor authentication; add another method first.");
  }
  return statusOf(next, role);
}

export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const { codes, hashes } = generateRecoveryCodes();
  await mfaStore.upsert(userId, { recoveryCodeHashes: hashes });
  return codes;
}

/** Admin action: wipe a user's MFA (lost phone). Audited by the route. */
export function resetMfaForUser(userId: string): Promise<void> {
  return mfaStore.clear(userId);
}
