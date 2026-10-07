import type { User } from "@/context/AuthContext";
import { mobileApiFetch, setMobileApiToken } from "@/services/apiClient";
import type { MfaMethod } from "@/services/authRepository";

/**
 * Two-factor authentication API (server: artifacts/api-server/src/routes/mfa.ts).
 * Every call needs API mode — 2FA is enforced by the server, so there is no
 * offline/local fallback for it.
 */
export interface MfaStatus {
  totpEnabled: boolean;
  smsEnabled: boolean;
  smsMaskedPhone: string | null;
  recoveryCodesRemaining: number;
  required: boolean;
  enrolled: boolean;
}

export type MfaResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

async function call<T>(path: string, method: "GET" | "POST", body?: unknown, requireAuth = true): Promise<MfaResult<T>> {
  const res = await mobileApiFetch<T & { error?: string; code?: string }>({ method, path, body, requireAuth, timeoutMs: 10000 });
  if (res.ok) return { ok: true, data: res.data };
  return { ok: false, error: res.error || "Request failed. Check your connection.", code: undefined };
}

/** Second login step. On success the full session token is stored. */
export async function verifyMfa(challengeToken: string, method: MfaMethod, code: string) {
  const res = await call<{ token: string; user: Partial<User> }>("/auth/mfa/verify", "POST", { challengeToken, method, code }, false);
  if (res.ok) await setMobileApiToken(res.data.token);
  return res;
}

export function sendMfaSms(challengeToken: string) {
  return call<{ maskedPhone: string; devCode?: string }>("/auth/mfa/sms/send", "POST", { challengeToken }, false);
}

export function getMfaStatus() {
  return call<MfaStatus>("/auth/mfa", "GET");
}

export function startTotpSetup() {
  return call<{ secret: string; otpauthUri: string }>("/auth/mfa/totp/setup", "POST", {});
}

interface EnrolResult {
  status: MfaStatus;
  recoveryCodes?: string[];
  /** Present when a restricted (enrol-only) session was upgraded. */
  token?: string;
}

async function finishEnrolment(res: MfaResult<EnrolResult>) {
  if (res.ok && res.data.token) await setMobileApiToken(res.data.token);
  return res;
}

export async function confirmTotpSetup(code: string) {
  return finishEnrolment(await call<EnrolResult>("/auth/mfa/totp/confirm", "POST", { code }));
}

export function startSmsSetup(phone: string) {
  return call<{ maskedPhone: string; devCode?: string }>("/auth/mfa/sms/setup", "POST", { phone });
}

export async function confirmSmsSetup(code: string) {
  return finishEnrolment(await call<EnrolResult>("/auth/mfa/sms/confirm", "POST", { code }));
}

export function disableMfaMethod(method: "totp" | "sms", proofMethod: "totp" | "recovery", code: string) {
  return call<{ status: MfaStatus }>("/auth/mfa/disable", "POST", { method, proofMethod, code });
}

export function regenerateRecoveryCodes() {
  return call<{ recoveryCodes: string[] }>("/auth/mfa/recovery-codes", "POST", {});
}
