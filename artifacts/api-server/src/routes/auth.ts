import { Router, type IRouter } from "express";
import { z } from "zod";
import { AuthLoginSchema } from "@workspace/api-zod";
import {
  authenticate,
  capabilitiesForRole,
  isTokenRevoked,
  revokeToken,
  signToken,
  userRepository,
  verifyToken,
} from "../lib/auth";
import { recordAuditEvent } from "../lib/auditStore";
import { consumeResetGrant, issueOtp, verifyOtp } from "../lib/otpStore";
import { rateLimit } from "../lib/rateLimit";
import { deliverOtp } from "../lib/pushSender";
import { getAuth } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many login attempts. Try again in a few minutes.",
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyFor: (req) => `${req.ip}:${String((req.body as { badgeNumber?: string })?.badgeNumber ?? "")}`,
  message: "Too many OTP requests. Try again in a few minutes.",
});

// POST /api/auth/login — badge + PIN login (DB-backed or demo). Returns a bearer
// token + user. PIN hashes are never returned.
router.post("/auth/login", loginLimiter, async (req, res) => {
  const result = AuthLoginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  const outcome = await authenticate(result.data.badgeNumber, result.data.pin, result.data.agency);
  if (!outcome.ok) {
    recordAuditEvent({
      type: "auth",
      title: "Login failed",
      detail: `Failed login for badge ${result.data.badgeNumber.toUpperCase()} (${outcome.reason})`,
      severity: "warning",
    });
    if (outcome.reason === "inactive") {
      res.status(403).json({ error: "This account is inactive. Contact an administrator." });
      return;
    }
    res.status(401).json({ error: "Invalid badge number or PIN." });
    return;
  }
  const { user } = outcome;
  recordAuditEvent({
    type: "auth",
    title: "Login",
    detail: `${user.name} (${user.badgeNumber}) signed in`,
    actorUserId: user.id,
    actorAgency: user.agency,
  });
  res.json({
    token: signToken(user),
    user,
    agency: user.agency,
    role: user.role,
    capabilities: capabilitiesForRole(user.role),
  });
});

// POST /api/auth/refresh — rotate a still-valid token: issue a fresh one and
// revoke the old. Expired tokens cannot refresh (client must log in again).
router.post("/auth/refresh", async (req, res) => {
  const header = req.header("authorization");
  const raw = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  const claims = raw ? verifyToken(raw) : null;
  if (!claims || (await isTokenRevoked(claims))) {
    res.status(401).json({ error: "A valid session token is required to refresh." });
    return;
  }
  const token = signToken({
    id: claims.sub,
    name: claims.name,
    badgeNumber: claims.badgeNumber,
    agency: claims.agency,
    role: claims.role,
  });
  await revokeToken(claims);
  res.json({ token });
});

// POST /api/auth/logout — revoke the presented token server-side.
router.post("/auth/logout", async (req, res) => {
  const auth = getAuth(req);
  if (auth) {
    await revokeToken(auth);
    recordAuditEvent({
      type: "auth",
      title: "Logout",
      detail: `${auth.name} (${auth.badgeNumber}) signed out`,
      actorUserId: auth.sub,
      actorAgency: auth.agency,
    });
  }
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

// ---- Self-service PIN reset (OTP) -------------------------------------------

const OtpRequestSchema = z.object({
  badgeNumber: z.string().min(3).max(30),
  email: z.string().email().max(160).optional().or(z.literal("")),
});

const OtpVerifySchema = z.object({
  badgeNumber: z.string().min(3).max(30),
  code: z.string().min(4).max(10),
});

const PinResetSchema = z.object({
  badgeNumber: z.string().min(3).max(30),
  newPin: z.string().regex(/^\d{4,12}$/, "PIN must be 4-12 digits"),
});

// POST /api/auth/otp/request — issue a one-time code for PIN reset. The code
// is delivered to the *user's own device* (push) and the server log — never to
// the caller-supplied email — so requesting an OTP for someone else's badge
// yields nothing useful. Responses do not reveal whether a badge exists beyond
// the mobile contract's result field.
router.post("/auth/otp/request", otpLimiter, async (req, res) => {
  const parsed = OtpRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  const user = await userRepository.findByBadge(parsed.data.badgeNumber);
  if (!user) {
    res.json({ result: "not_found" });
    return;
  }
  if (user.email && parsed.data.email && user.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    res.json({ result: "email_mismatch" });
    return;
  }
  const code = issueOtp(user.badgeNumber);
  const delivered = await deliverOtp(user.id, user.badgeNumber, code);
  recordAuditEvent({
    type: "auth",
    title: "PIN reset OTP requested",
    detail: `OTP issued for ${user.badgeNumber} (delivered via ${delivered})`,
    actorUserId: user.id,
    actorAgency: user.agency,
  });
  // Demo aid: outside production the code is echoed so the flow is testable
  // without push delivery. Never echoed in production.
  if (process.env.NODE_ENV !== "production") {
    res.json({ result: "sent", code });
    return;
  }
  res.json({ result: "sent" });
});

// POST /api/auth/otp/verify — check the code; success grants a one-shot,
// short-lived PIN reset for that badge.
router.post("/auth/otp/verify", otpLimiter, async (req, res) => {
  const parsed = OtpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  const result = verifyOtp(parsed.data.badgeNumber, parsed.data.code);
  if (result !== "ok") {
    recordAuditEvent({
      type: "auth",
      title: "PIN reset OTP rejected",
      detail: `OTP verification for ${parsed.data.badgeNumber.toUpperCase()} failed (${result})`,
      severity: "warning",
    });
  }
  res.json({ result });
});

// POST /api/auth/pin/reset — consume the OTP grant and set the new PIN.
router.post("/auth/pin/reset", loginLimiter, async (req, res) => {
  const parsed = PinResetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  if (!consumeResetGrant(parsed.data.badgeNumber)) {
    res.status(403).json({ ok: false, error: "OTP verification is required before resetting the PIN." });
    return;
  }
  try {
    const ok = await userRepository.resetPinByBadge(parsed.data.badgeNumber, parsed.data.newPin);
    recordAuditEvent({
      type: "auth",
      title: ok ? "PIN reset" : "PIN reset failed",
      detail: `Self-service PIN reset for ${parsed.data.badgeNumber.toUpperCase()} ${ok ? "completed" : "failed (demo mode or unknown badge)"}`,
      severity: ok ? "info" : "warning",
    });
    res.json({ ok });
  } catch (error) {
    logger.error({ err: error }, "PIN reset failed");
    res.status(500).json({ ok: false, error: "Internal error resetting the PIN." });
  }
});

export default router;
