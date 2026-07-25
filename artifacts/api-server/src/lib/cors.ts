import cors, { type CorsOptions } from "cors";
import type { RequestHandler } from "express";
import { logger } from "./logger";

/**
 * CORS policy.
 *
 * The native mobile apps do NOT send an `Origin` header, so they are never
 * subject to CORS and always pass — the allowlist exists purely for browser
 * origins (the web/admin surface, local tooling). Requests from a browser
 * origin that is not on the allowlist get no CORS headers, so the browser
 * blocks the response.
 *
 * Configure with `CORS_ALLOWED_ORIGINS` (comma-separated exact origins, e.g.
 * `https://admin.securityapp.gov.ng,https://securityapp.gov.ng`). Outside
 * production, if nothing is configured we reflect the request origin so local
 * web tooling (Vite on some port, etc.) keeps working. In production an empty
 * allowlist means "native only" — the safe default.
 */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function buildCorsMiddleware(): RequestHandler {
  const allowed = parseAllowedOrigins(process.env["CORS_ALLOWED_ORIGINS"]);
  const isProd = process.env["NODE_ENV"] === "production";

  if (allowed.length === 0 && !isProd) {
    logger.warn("CORS: no CORS_ALLOWED_ORIGINS set — reflecting request origin (development only).");
  } else {
    logger.info({ allowed }, "CORS: allowlist active");
  }

  const options: CorsOptions = {
    origin(origin, callback) {
      // No Origin => native app / server-to-server / curl. Always allow.
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      // Dev convenience: with no allowlist configured, reflect the origin.
      if (allowed.length === 0 && !isProd) return callback(null, true);
      // Disallowed browser origin: respond without CORS headers (browser blocks).
      logger.warn({ origin }, "CORS: blocked disallowed origin");
      return callback(null, false);
    },
    credentials: true,
    maxAge: 600,
  };

  return cors(options);
}
