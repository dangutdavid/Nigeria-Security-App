import { getMobileApiConfig, shouldUseApi } from "@/services/apiConfig";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions<TBody = unknown> {
  method?: ApiMethod;
  path: string;
  body?: TBody;
  headers?: Record<string, string>;
  timeoutMs?: number;
  requireAuth?: boolean;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  status: number;
  fromApi: true;
}

export interface ApiFallback {
  ok: false;
  status?: number;
  error: string;
  shouldFallback: true;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFallback;
export type AuthTokenGetter = () => Promise<string | null> | string | null;

let authTokenGetter: AuthTokenGetter | null = null;

export function setMobileAuthTokenGetter(getter: AuthTokenGetter | null) {
  authTokenGetter = getter;
}

export async function mobileApiFetch<TResponse, TBody = unknown>(
  options: ApiRequestOptions<TBody>,
): Promise<ApiResult<TResponse>> {
  const config = getMobileApiConfig();
  if (!shouldUseApi() || !config.baseUrl) {
    return { ok: false, error: "API mode is disabled or missing EXPO_PUBLIC_API_BASE_URL.", shouldFallback: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? config.timeoutMs);

  try {
    const token = options.requireAuth ? await authTokenGetter?.() : null;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...options.headers,
    };

    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${config.baseUrl}${normalizePath(options.path)}`, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: errorMessageFromResponse(response.status, data),
        shouldFallback: true,
      };
    }

    return { ok: true, data: data as TResponse, status: response.status, fromApi: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "API request failed.",
      shouldFallback: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function errorMessageFromResponse(status: number, data: unknown) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = record.error ?? record.message ?? record.detail;
    if (typeof message === "string") return message;
  }
  return `API request failed with status ${status}.`;
}
