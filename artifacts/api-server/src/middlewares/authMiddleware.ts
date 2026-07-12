import type { NextFunction, Request, Response } from "express";
import { isAdminRole, isTokenRevoked, verifyToken, type AuthClaims } from "../lib/auth";

export type AuthedRequest = Request & { auth?: AuthClaims };

/**
 * Parse `Authorization: Bearer <token>` and attach verified claims to the
 * request. Non-blocking — unauthenticated requests still pass through so public
 * endpoints keep working. Security decisions use these server-verified claims,
 * never client-supplied agency/role headers. Revoked tokens (logout / refresh
 * rotation) are rejected here.
 */
export async function attachAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header("authorization");
  if (header && header.startsWith("Bearer ")) {
    const claims = verifyToken(header.slice("Bearer ".length).trim());
    if (claims && !(await isTokenRevoked(claims))) {
      (req as AuthedRequest).auth = claims;
    }
  }
  next();
}

export function getAuth(req: Request): AuthClaims | undefined {
  return (req as AuthedRequest).auth;
}

/** Returns the claims, or sends 401 and returns null. */
export function requireAuth(req: Request, res: Response): AuthClaims | null {
  const auth = getAuth(req);
  if (!auth) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }
  return auth;
}

/** Returns claims if admin/super_admin, else sends 403 (or 401) and returns null. */
export function requireAdmin(req: Request, res: Response): AuthClaims | null {
  const auth = requireAuth(req, res);
  if (!auth) return null;
  if (!isAdminRole(auth.role)) {
    res.status(403).json({ error: "Administrator access required." });
    return null;
  }
  return auth;
}

/**
 * Returns claims if the user is an admin or belongs to `agency`, else sends
 * 401/403 and returns null. Agency comparison is case-insensitive.
 */
export function requireAgencyAccess(req: Request, res: Response, agency: string): AuthClaims | null {
  const auth = requireAuth(req, res);
  if (!auth) return null;
  if (isAdminRole(auth.role)) return auth;
  if (auth.agency.toLowerCase() !== agency.trim().toLowerCase()) {
    res.status(403).json({ error: "You can only access your own agency's data." });
    return null;
  }
  return auth;
}
