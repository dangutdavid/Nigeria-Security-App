import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { capabilitiesForRole, revokeToken, signToken, type Role } from "../lib/auth";
import { recordAuditEvent } from "../lib/auditStore";
import {
  MfaError,
  beginSmsEnrolment,
  beginTotpEnrolment,
  confirmSmsEnrolment,
  confirmTotpEnrolment,
  disableFactor,
  getMfaStatus,
  parseChallenge,
  regenerateRecoveryCodes,
  resetMfaForUser,
  sendChallengeSms,
  verifyChallenge,
} from "../lib/mfa";
import { SmsDeliveryError } from "../lib/sms";
import { envInt, rateLimit } from "../lib/rateLimit";
import { getAuth, requireAuth, requireCapability } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Brute-force guards on top of the per-challenge attempt cap (5).
const verifyLimiter = rateLimit({
  name: "mfa_verify",
  windowMs: envInt("MFA_VERIFY_RATE_WINDOW_MS", 15 * 60 * 1000),
  max: envInt("MFA_VERIFY_RATE_MAX", 20),
  message: "Too many verification attempts. Try again in a few minutes.",
});
const smsLimiter = rateLimit({
  name: "mfa_sms_send",
  windowMs: 15 * 60 * 1000,
  max: envInt("MFA_SMS_RATE_MAX", 5),
  message: "Too many SMS codes requested. Try again in a few minutes.",
});

const code = z.string().trim().min(6).max(16);
const VerifySchema = z.object({ challengeToken: z.string().min(20), method: z.enum(["totp", "sms", "recovery"]), code });
const ChallengeSchema = z.object({ challengeToken: z.string().min(20) });
const CodeSchema = z.object({ code });
const PhoneSchema = z.object({ phone: z.string().trim().min(8).max(20) });
const DisableSchema = z.object({ method: z.enum(["totp", "sms"]), proofMethod: z.enum(["totp", "recovery"]), code });

function handle(res: Response, err: unknown): void {
  if (err instanceof MfaError) {
    const status = err.code === "too_many_attempts" ? 429 : err.code === "challenge_invalid" ? 401 : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof SmsDeliveryError) {
    res.status(502).json({ error: "We couldn't send the SMS. Try the authenticator app or a recovery code.", code: "sms_failed" });
    return;
  }
  logger.error({ err }, "MFA request failed");
  res.status(500).json({ error: "Two-factor request failed." });
}

// ---- Login second step (no session yet) -----------------------------------------

router.post("/auth/mfa/sms/send", smsLimiter, async (req, res) => {
  const parsed = ChallengeSchema.safeParse(req.body);
  const challenge = parsed.success ? parseChallenge(parsed.data.challengeToken) : null;
  if (!challenge) {
    res.status(401).json({ error: "This sign-in attempt has expired. Please sign in again.", code: "challenge_invalid" });
    return;
  }
  try {
    res.json(await sendChallengeSms(challenge));
  } catch (err) {
    handle(res, err);
  }
});

router.post("/auth/mfa/verify", verifyLimiter, async (req, res) => {
  const parsed = VerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  try {
    const { user, method } = await verifyChallenge(parsed.data.challengeToken, parsed.data.method, parsed.data.code);
    recordAuditEvent({
      type: "auth",
      title: "Login (two-factor)",
      detail: `${user.name} (${user.badgeNumber}) signed in with PIN + ${method}`,
      actorUserId: user.id,
      actorAgency: user.agency,
      ...(method === "recovery" ? { severity: "warning" as const } : {}),
    });
    res.json({
      token: signToken(user, { amr: ["pin", method === "totp" ? "otp" : method] }),
      user,
      agency: user.agency,
      role: user.role,
      capabilities: capabilitiesForRole(user.role as Role),
    });
  } catch (err) {
    if (err instanceof MfaError) {
      recordAuditEvent({ type: "auth", title: "Two-factor failed", detail: `Second-factor failure (${err.code})`, severity: "warning" });
    }
    handle(res, err);
  }
});

// ---- Enrolment & management (authenticated user, own account) ------------------

router.get("/auth/mfa", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    res.json(await getMfaStatus(auth.sub, auth.role));
  } catch (err) {
    handle(res, err);
  }
});

router.post("/auth/mfa/totp/setup", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    res.json(await beginTotpEnrolment({ id: auth.sub, badgeNumber: auth.badgeNumber }));
  } catch (err) {
    handle(res, err);
  }
});

/**
 * Completing enrolment from a restricted (mfa_enroll) session upgrades it to a
 * full session: the user has just proven possession of the second factor.
 */
async function enrolmentCompleted(req: Parameters<typeof getAuth>[0], res: Response, method: "otp" | "sms", recoveryCodes?: string[]) {
  const auth = getAuth(req)!;
  recordAuditEvent({
    type: "auth",
    title: "Two-factor enrolled",
    detail: `${auth.name} (${auth.badgeNumber}) enabled ${method === "otp" ? "authenticator app" : "SMS"} verification`,
    actorUserId: auth.sub,
    actorAgency: auth.agency,
  });
  const user = { id: auth.sub, name: auth.name, badgeNumber: auth.badgeNumber, agency: auth.agency, role: auth.role };
  const upgraded = auth.scope === "mfa_enroll";
  if (upgraded) await revokeToken(auth);
  res.json({
    status: await getMfaStatus(auth.sub, auth.role),
    ...(recoveryCodes ? { recoveryCodes } : {}),
    ...(upgraded
      ? { token: signToken(user, { amr: ["pin", method] }), capabilities: capabilitiesForRole(auth.role) }
      : {}),
  });
}

router.post("/auth/mfa/totp/confirm", verifyLimiter, async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const parsed = CodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the 6-digit code from your authenticator app." });
    return;
  }
  try {
    const { recoveryCodes } = await confirmTotpEnrolment(auth.sub, parsed.data.code);
    await enrolmentCompleted(req, res, "otp", recoveryCodes);
  } catch (err) {
    handle(res, err);
  }
});

router.post("/auth/mfa/sms/setup", smsLimiter, async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const parsed = PhoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid phone number." });
    return;
  }
  try {
    res.json(await beginSmsEnrolment(auth.sub, parsed.data.phone));
  } catch (err) {
    handle(res, err);
  }
});

router.post("/auth/mfa/sms/confirm", verifyLimiter, async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const parsed = CodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the 6-digit code we sent you." });
    return;
  }
  try {
    const { recoveryCodes } = await confirmSmsEnrolment(auth.sub, parsed.data.code);
    await enrolmentCompleted(req, res, "sms", recoveryCodes);
  } catch (err) {
    handle(res, err);
  }
});

router.post("/auth/mfa/disable", verifyLimiter, async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const parsed = DisableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  try {
    const status = await disableFactor(auth.sub, auth.role, parsed.data.method, { method: parsed.data.proofMethod, code: parsed.data.code });
    recordAuditEvent({
      type: "auth",
      title: "Two-factor method removed",
      detail: `${auth.name} (${auth.badgeNumber}) removed ${parsed.data.method}`,
      actorUserId: auth.sub,
      actorAgency: auth.agency,
      severity: "warning",
    });
    res.json({ status });
  } catch (err) {
    handle(res, err);
  }
});

router.post("/auth/mfa/recovery-codes", verifyLimiter, async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  if (!auth.amr?.some((m) => m !== "pin")) {
    res.status(403).json({ error: "Sign in with your second factor to manage recovery codes.", code: "mfa_step_up_required" });
    return;
  }
  try {
    const recoveryCodes = await regenerateRecoveryCodes(auth.sub);
    recordAuditEvent({ type: "auth", title: "Recovery codes regenerated", detail: `${auth.name} (${auth.badgeNumber})`, actorUserId: auth.sub, actorAgency: auth.agency });
    res.json({ recoveryCodes });
  } catch (err) {
    handle(res, err);
  }
});

// ---- Admin: reset a user's MFA (lost device) -------------------------------------

router.post("/admin/users/:userId/mfa/reset", async (req, res) => {
  const admin = requireCapability(req, res, "mfa:reset");
  if (!admin) return;
  try {
    await resetMfaForUser(String(req.params.userId));
    recordAuditEvent({
      type: "admin",
      title: "Two-factor reset",
      detail: `${admin.name} reset two-factor authentication for user ${req.params.userId}`,
      actorUserId: admin.sub,
      actorAgency: admin.agency,
      targetId: String(req.params.userId),
      severity: "warning",
    });
    res.json({ ok: true });
  } catch (err) {
    handle(res, err);
  }
});

export default router;
