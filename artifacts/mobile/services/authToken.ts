import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Bearer-token storage for the backend API session.
 *
 * Prefers expo-secure-store (device keychain/keystore). Falls back to
 * AsyncStorage only when SecureStore is unavailable (e.g. SSR/web or a platform
 * without secure storage). No API keys are ever stored on device — only the
 * short-lived session token issued by the backend after login.
 */

// SecureStore keys must be [A-Za-z0-9._-] (no "@"); use a compatible key.
const TOKEN_KEY = "security_api_auth_token_v1";

let cached: string | null = null;
let loaded = false;
let secureAvailable: boolean | null = null;

async function useSecureStore(): Promise<boolean> {
  if (secureAvailable === null) {
    try {
      secureAvailable = await SecureStore.isAvailableAsync();
    } catch {
      secureAvailable = false;
    }
  }
  return secureAvailable;
}

export async function saveAuthToken(token: string): Promise<void> {
  cached = token;
  loaded = true;
  try {
    if (await useSecureStore()) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      return;
    }
  } catch {
    // fall through to AsyncStorage
  }
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Non-fatal: token remains in memory for this session.
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (loaded) return cached;
  try {
    cached = (await useSecureStore())
      ? await SecureStore.getItemAsync(TOKEN_KEY)
      : await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    try {
      cached = await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      cached = null;
    }
  }
  loaded = true;
  return cached;
}

export async function clearAuthToken(): Promise<void> {
  cached = null;
  loaded = true;
  try {
    if (await useSecureStore()) await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
  // Always clear any AsyncStorage fallback copy too.
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export async function hasAuthToken(): Promise<boolean> {
  return Boolean(await getAuthToken());
}
