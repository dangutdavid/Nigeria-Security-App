import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Proof-of-ownership for reports submitted from THIS device: the report
 * reference + the private clientId generated at submission. Needed to export
 * or request erasure of your own report (citizens are anonymous — possession
 * of this key is how the server knows the request is yours). Stored in the
 * device keychain/keystore where available; never sent anywhere except with
 * your own privacy requests.
 */
const KEY = "my_report_keys_v1"; // SecureStore keys: [A-Za-z0-9._-]

export interface MyReportKey {
  reference: string;
  clientId: string;
  submittedAt: string;
}

async function secureAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function readAll(): Promise<MyReportKey[]> {
  try {
    const raw = (await secureAvailable()) ? await SecureStore.getItemAsync(KEY) : await AsyncStorage.getItem(`@${KEY}`);
    return raw ? (JSON.parse(raw) as MyReportKey[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(keys: MyReportKey[]): Promise<void> {
  const raw = JSON.stringify(keys.slice(0, 200));
  if (await secureAvailable()) await SecureStore.setItemAsync(KEY, raw);
  else await AsyncStorage.setItem(`@${KEY}`, raw);
}

export async function rememberReportKey(reference: string, clientId: string): Promise<void> {
  const keys = await readAll();
  if (keys.some((k) => k.reference.toUpperCase() === reference.toUpperCase())) return;
  await writeAll([{ reference: reference.toUpperCase(), clientId, submittedAt: new Date().toISOString() }, ...keys]);
}

export async function findReportKey(reference: string): Promise<MyReportKey | null> {
  const target = reference.trim().toUpperCase();
  return (await readAll()).find((k) => k.reference === target) ?? null;
}
