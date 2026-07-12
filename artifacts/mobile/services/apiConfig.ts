declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export interface MobileApiConfig {
  useApi: boolean;
  baseUrl: string | null;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 10000;

function readEnv(name: string): string | undefined {
  return process?.env?.[name];
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function getMobileApiConfig(): MobileApiConfig {
  const useApi = readEnv("EXPO_PUBLIC_USE_API")?.toLowerCase() === "true";
  const baseUrl = normalizeBaseUrl(readEnv("EXPO_PUBLIC_API_BASE_URL"));
  const timeoutCandidate = Number(readEnv("EXPO_PUBLIC_API_TIMEOUT_MS"));

  return {
    useApi: useApi && Boolean(baseUrl),
    baseUrl,
    timeoutMs: Number.isFinite(timeoutCandidate) && timeoutCandidate > 0 ? timeoutCandidate : DEFAULT_TIMEOUT_MS,
  };
}

export function shouldUseApi(): boolean {
  return getMobileApiConfig().useApi;
}

export function explainApiMode(): string {
  const config = getMobileApiConfig();
  if (!readEnv("EXPO_PUBLIC_USE_API")) {
    return "API mode is disabled. Set EXPO_PUBLIC_USE_API=true and EXPO_PUBLIC_API_BASE_URL to enable backend calls.";
  }
  if (!config.baseUrl) {
    return "API mode was requested, but EXPO_PUBLIC_API_BASE_URL is missing. Local AsyncStorage fallback remains active.";
  }
  if (!config.useApi) {
    return "API mode is not active. Local AsyncStorage fallback remains active.";
  }
  return `API mode enabled for ${config.baseUrl}. Local AsyncStorage fallback remains available on request failure.`;
}

// To enable backend API mode later in Expo:
// EXPO_PUBLIC_USE_API=true
// EXPO_PUBLIC_API_BASE_URL=http://YOUR-LAN-IP:8081/api
// Do not hardcode production URLs in the mobile bundle.
