import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";
import { sentryErrorHook } from "../lib/sentry";

/**
 * Consistent JSON error surface for anything routes don't handle themselves:
 * { error, code } — code is a stable machine-readable identifier.
 */

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found.", code: "not_found" });
}

interface HttpishError {
  status?: number;
  statusCode?: number;
  type?: string;
  message?: string;
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  const e = (err ?? {}) as HttpishError;
  const status = e.status ?? e.statusCode;

  // body-parser: malformed JSON
  if (e.type === "entity.parse.failed" || (status === 400 && err instanceof SyntaxError)) {
    res.status(400).json({ error: "Malformed request body.", code: "bad_request_body" });
    return;
  }
  // body-parser / raw: payload too large
  if (e.type === "entity.too.large" || status === 413) {
    res.status(413).json({ error: "Request body too large.", code: "payload_too_large" });
    return;
  }
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ error: e.message ?? "Request failed.", code: "request_error" });
    return;
  }

  logger.error({ err, url: req.originalUrl }, "Unhandled request error");
  // Forward to Sentry (no-op without SENTRY_DSN), joined by the correlation id.
  sentryErrorHook(err, res.getHeader("X-Request-Id")?.toString(), req.originalUrl?.split("?")[0] ?? "unknown");
  res.status(500).json({ error: "Internal server error.", code: "internal_error" });
}
