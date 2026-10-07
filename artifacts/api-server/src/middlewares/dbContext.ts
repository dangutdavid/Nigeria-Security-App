import type { NextFunction, Request, Response } from "express";
import { isDbConfigured, withDbContext, type DbRole } from "@workspace/db";
import { getAuth } from "./authMiddleware";
import { logger } from "../lib/logger";

/**
 * Bind every request to a database connection that carries the caller's
 * identity, so Postgres row-level security (migration 0004) scopes every query
 * to what this caller may see. Runs after attachAuth: identity comes ONLY from
 * the server-verified token, never from client-supplied headers.
 *
 * The connection is held until the response finishes, then its settings are
 * wiped before it returns to the pool (see withDbContext).
 */
export function dbContext(req: Request, res: Response, next: NextFunction): void {
  if (!isDbConfigured()) {
    next();
    return;
  }
  const auth = getAuth(req);
  const context = auth
    ? { role: auth.role as DbRole, agency: auth.agency, userId: auth.sub }
    : { role: "anonymous" as const };

  withDbContext(
    context,
    () =>
      new Promise<void>((resolve) => {
        res.once("finish", resolve);
        res.once("close", resolve);
        next();
      }),
  ).catch((err) => {
    logger.error({ err }, "Failed to establish database security context");
    if (!res.headersSent) res.status(503).json({ error: "Service temporarily unavailable." });
  });
}
