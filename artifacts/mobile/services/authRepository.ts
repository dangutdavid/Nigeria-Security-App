import type {
  AgencyType,
  LoginResult,
  OtpResult,
  OtpVerifyResult,
  User,
} from "@/context/AuthContext";
import { hasAuthToken, mobileApiFetch, setMobileApiToken } from "@/services/apiClient";
import { shouldUseApi } from "@/services/apiConfig";

export interface AuthRepositoryLocalAdapter {
  login?: (badgeNumber: string, pin: string, agency?: AgencyType) => Promise<LoginResult>;
  logout?: () => Promise<void>;
  getCurrentUser?: () => User | null | Promise<User | null>;
  requestOtp?: (badgeNumber: string, email: string) => Promise<{ result: OtpResult; code?: string }>;
  verifyOtp?: (badgeNumber: string, code: string) => Promise<OtpVerifyResult>;
  resetPin?: (badgeNumber: string, newPin: string) => Promise<boolean>;
}

interface LoginResponse {
  user?: User;
  token?: string;
}

/**
 * Best-effort backend session: in API mode, log in against the backend and
 * persist the returned bearer token (so protected report/agency calls
 * authenticate). Returns false when API mode is off or login fails — the caller
 * keeps using local AuthContext, so demo/offline login is never blocked.
 */
export async function establishApiSession(
  badgeNumber: string,
  pin: string,
  agency?: AgencyType,
  options: { timeoutMs?: number } = {},
): Promise<boolean> {
  if (!shouldUseApi()) return false;
  const api = await mobileApiFetch<LoginResponse, { badgeNumber: string; pin: string; agency?: AgencyType }>({
    method: "POST",
    path: "/auth/login",
    body: { badgeNumber, pin, agency },
    // Short timeout so a slow/unreachable backend never blocks local login.
    timeoutMs: options.timeoutMs ?? 4000,
  });
  if (api.ok && api.data.token) {
    await setMobileApiToken(api.data.token);
    return true;
  }
  return false;
}

/**
 * On startup, if API mode is on and a token is stored, validate it against
 * /api/auth/me. Clears the token only when the server says it is invalid
 * (401/403); a network error / unreachable backend leaves the token in place so
 * the user is not logged out of local mode unnecessarily.
 */
export async function validateApiSession(): Promise<boolean> {
  if (!shouldUseApi()) return false;
  if (!(await hasAuthToken())) return false;
  const api = await mobileApiFetch<{ user?: User }>({
    method: "GET",
    path: "/auth/me",
    requireAuth: true,
    timeoutMs: 4000,
  });
  if (api.ok) {
    // Rotate the token while it is still valid so an active user is never
    // forced to re-login when the 12h TTL lapses. Best-effort — a failed
    // refresh keeps the current (still valid) token.
    const refreshed = await mobileApiFetch<{ token?: string }>({
      method: "POST",
      path: "/auth/refresh",
      requireAuth: true,
      timeoutMs: 4000,
    });
    if (refreshed.ok && refreshed.data.token) {
      await setMobileApiToken(refreshed.data.token);
    }
    return true;
  }
  if (api.status === 401 || api.status === 403) {
    await setMobileApiToken(null);
  }
  return false;
}

/** Clear the persisted backend session (best-effort logout + token wipe). */
export async function clearApiSession(): Promise<void> {
  if (shouldUseApi()) {
    await mobileApiFetch<{ ok: boolean }>({ method: "POST", path: "/auth/logout", requireAuth: true, timeoutMs: 4000 });
  }
  await setMobileApiToken(null);
}

export function createAuthRepository(local: AuthRepositoryLocalAdapter = {}) {
  return {
    login: (badgeNumber: string, pin: string, agency?: AgencyType) => login(badgeNumber, pin, agency, local),
    logout: () => logout(local),
    getCurrentUser: () => getCurrentUser(local),
    requestOtp: (badgeNumber: string, email: string) => requestOtp(badgeNumber, email, local),
    verifyOtp: (badgeNumber: string, code: string) => verifyOtp(badgeNumber, code, local),
    resetPin: (badgeNumber: string, newPin: string) => resetPin(badgeNumber, newPin, local),
  };
}

export async function login(
  badgeNumber: string,
  pin: string,
  agency?: AgencyType,
  local: AuthRepositoryLocalAdapter = {},
): Promise<LoginResult> {
  const api = await mobileApiFetch<LoginResponse, { badgeNumber: string; pin: string; agency?: AgencyType }>({
    method: "POST",
    path: "/auth/login",
    body: { badgeNumber, pin, agency },
  });

  if (api.ok && api.data.user) {
    await setMobileApiToken(api.data.token ?? null);
    return "ok";
  }

  return local.login ? local.login(badgeNumber, pin, agency) : "invalid";
}

export async function logout(local: AuthRepositoryLocalAdapter = {}): Promise<void> {
  await mobileApiFetch<{ ok: boolean }>({ method: "POST", path: "/auth/logout", requireAuth: true });
  await setMobileApiToken(null);
  await local.logout?.();
}

export async function getCurrentUser(local: AuthRepositoryLocalAdapter = {}): Promise<User | null> {
  const api = await mobileApiFetch<{ user?: User }>({ method: "GET", path: "/auth/me", requireAuth: true });
  if (api.ok) return api.data.user ?? null;
  return local.getCurrentUser ? local.getCurrentUser() : null;
}

export async function requestOtp(
  badgeNumber: string,
  email: string,
  local: AuthRepositoryLocalAdapter = {},
): Promise<{ result: OtpResult; code?: string }> {
  const api = await mobileApiFetch<{ result?: OtpResult; code?: string }, { badgeNumber: string; email: string }>({
    method: "POST",
    path: "/auth/otp/request",
    body: { badgeNumber, email },
  });

  if (api.ok && api.data.result) return { result: api.data.result, code: api.data.code };
  return local.requestOtp ? local.requestOtp(badgeNumber, email) : { result: "not_found" };
}

export async function verifyOtp(
  badgeNumber: string,
  code: string,
  local: AuthRepositoryLocalAdapter = {},
): Promise<OtpVerifyResult> {
  const api = await mobileApiFetch<{ result?: OtpVerifyResult }, { badgeNumber: string; code: string }>({
    method: "POST",
    path: "/auth/otp/verify",
    body: { badgeNumber, code },
  });

  if (api.ok && api.data.result) return api.data.result;
  return local.verifyOtp ? local.verifyOtp(badgeNumber, code) : "invalid";
}

export async function resetPin(
  badgeNumber: string,
  newPin: string,
  local: AuthRepositoryLocalAdapter = {},
): Promise<boolean> {
  const api = await mobileApiFetch<{ ok?: boolean }, { badgeNumber: string; newPin: string }>({
    method: "POST",
    path: "/auth/pin/reset",
    body: { badgeNumber, newPin },
  });

  if (api.ok) return Boolean(api.data.ok);
  return local.resetPin ? local.resetPin(badgeNumber, newPin) : false;
}
