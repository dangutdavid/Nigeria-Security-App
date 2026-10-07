import type { NextFunction, Request, Response } from "express";
import { getAuth } from "./authMiddleware";

/**
 * A session minted for a user whose role requires two-factor authentication
 * but who has not enrolled yet carries scope "mfa_enroll". It may reach only
 * what's needed to enrol (and to see/close its own session) — every other
 * endpoint answers 403 mfa_enrollment_required so the app can route the user
 * to the setup screen.
 */
const ALLOWED = [/^\/api\/auth\/mfa(\/|$)/, /^\/api\/auth\/(me|logout|refresh)$/, /^\/api\/healthz$/];

export function enforceMfaScope(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (auth?.scope === "mfa_enroll" && !ALLOWED.some((re) => re.test(req.path))) {
    res.status(403).json({
      error: "Set up two-factor authentication to continue.",
      code: "mfa_enrollment_required",
    });
    return;
  }
  next();
}
