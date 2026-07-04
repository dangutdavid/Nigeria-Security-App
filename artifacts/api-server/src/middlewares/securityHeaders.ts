import type { NextFunction, Request, Response } from "express";

/**
 * Baseline security headers for a JSON API (no helmet dependency needed).
 * The CSP is strict because this server never serves HTML.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (depth > 10 || value === null || typeof value !== "object") return false;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (hasForbiddenKey((value as Record<string, unknown>)[key], depth + 1)) return true;
  }
  return false;
}

/**
 * Defence-in-depth beyond per-route Zod validation: reject JSON bodies that
 * smuggle prototype-pollution keys before any handler touches them.
 */
export function rejectPollutedBodies(req: Request, res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) && hasForbiddenKey(req.body)) {
    res.status(400).json({ error: "Request body contains forbidden keys.", code: "bad_request_body" });
    return;
  }
  next();
}
