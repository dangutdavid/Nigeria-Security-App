import Constants, { ExecutionEnvironment } from "expo-constants";

/**
 * Mobile error tracking (roadmap Phase 3.1), paired with the API's @sentry/node
 * so one incident links the mobile release ↔ API trace via the correlation id.
 *
 * Guarded on two fronts so it never breaks a working session:
 *  - Activates only when EXPO_PUBLIC_SENTRY_DSN is set. No DSN → no-op.
 *  - The native SDK is absent in Expo Go, so init is skipped there (the SDK
 *    ships in a dev/production build). The require is wrapped so a missing
 *    native module degrades to a no-op instead of a red screen.
 */
let sentry: typeof import("@sentry/react-native") | null = null;

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || isExpoGo()) return;
  try {
    // Lazy require so bundling never fails when the native module is stripped.
    const mod = require("@sentry/react-native") as typeof import("@sentry/react-native");
    mod.init({
      dsn,
      // App version tags releases so mobile crashes join the API by release.
      release: Constants.expoConfig?.version,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENV ?? (__DEV__ ? "development" : "production"),
      tracesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
      // Never ship user PINs / tokens in breadcrumbs.
      sendDefaultPii: false,
    });
    sentry = mod;
  } catch {
    // Native module unavailable (Expo Go, or plugin not run) — stay a no-op.
    sentry = null;
  }
}

/** Manually capture a handled error (no-op until initSentry succeeds). */
export function captureError(error: unknown): void {
  sentry?.captureException(error);
}
