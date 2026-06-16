import { Router, type IRouter } from "express";
import { AuthLoginSchema } from "@workspace/api-zod";
import { authenticate, capabilitiesForRole, signToken } from "../lib/auth";
import { getAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

// POST /api/auth/login — badge + PIN login (DB-backed or demo). Returns a bearer
// token + user. PIN hashes are never returned.
router.post("/auth/login", async (req, res) => {
  const result = AuthLoginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  const outcome = await authenticate(result.data.badgeNumber, result.data.pin, result.data.agency);
  if (!outcome.ok) {
    if (outcome.reason === "inactive") {
      res.status(403).json({ error: "This account is inactive. Contact an administrator." });
      return;
    }
    res.status(401).json({ error: "Invalid badge number or PIN." });
    return;
  }
  const { user } = outcome;
  res.json({
    token: signToken(user),
    user,
    agency: user.agency,
    role: user.role,
    capabilities: capabilitiesForRole(user.role),
  });
});

// POST /api/auth/logout — stateless tokens; the client discards its token.
router.post("/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

// GET /api/auth/me — return the authenticated user derived from the bearer token.
router.get("/auth/me", (req, res) => {
  const auth = getAuth(req);
  if (!auth) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  res.json({
    user: {
      id: auth.sub,
      name: auth.name,
      badgeNumber: auth.badgeNumber,
      agency: auth.agency,
      role: auth.role,
    },
    agency: auth.agency,
    role: auth.role,
    capabilities: capabilitiesForRole(auth.role),
  });
});

export default router;
