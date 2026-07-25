import * as Sentry from "@sentry/node";
import { logger } from "./logger";

/**
 * Error tracking (roadmap Phase 3 / E4). Activates only when SENTRY_DSN is
 * set, so local dev and tests carry zero overhead. Events are tagged with the
 * request correlation id (X-Request-Id) so one incident links the mobile
 * release ↔ API trace ↔ SQL statement in the logs.
 */
let enabled = false;

export function initSentry(): void {
  const dsn = process.env["SENTRY_DSN"];
  if (!dsn) return;
  if (enabled) return;
  Sentry.init({
    dsn,
    environment: process.env["NODE_ENV"] ?? "development",
    release: process.env["SENTRY_RELEASE"],
    // Error monitoring is the goal; keep transaction sampling light and
    // adjustable without a deploy.
    tracesSampleRate: Number(process.env["SENTRY_TRACES_SAMPLE_RATE"] ?? 0.05),
  });
  enabled = true;
  logger.info("Sentry error tracking enabled");
}

/** Report an unhandled request error, tagged with the correlation id. */
export function sentryErrorHook(err: unknown, requestId: string | undefined, route: string): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (requestId) scope.setTag("request_id", requestId);
    scope.setTag("route", route);
    Sentry.captureException(err);
  });
}
