import { Router, type IRouter } from "express";
import { z } from "zod";
import { recordAuditEvent } from "../lib/auditStore";
import { citizenReportStore } from "../lib/citizenReportStore";
import { getMfaStatus } from "../lib/mfa";
import { buildCitizenExport, buildStaffExport, eraseCitizenReport, findOwnedReport, requestCitizenErasure } from "../lib/privacy";
import { envInt, rateLimit } from "../lib/rateLimit";
import { requireAdmin, requireAuth } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const privacyLimiter = rateLimit({
  name: "privacy_request",
  windowMs: 60 * 60 * 1000,
  max: envInt("PRIVACY_RATE_MAX", 10),
  message: "Too many privacy requests. Try again later.",
});

const Proof = z.object({ reference: z.string().trim().min(6).max(64), clientId: z.string().min(8).max(128) });
const ErasureRequest = Proof.extend({ reason: z.string().max(1000).optional() });
const NOT_FOUND = { error: "No report matches that reference and device.", code: "not_found" };

// Citizen: download everything held about my report (right of access/portability).
router.post("/privacy/citizen-reports/export", privacyLimiter, async (req, res) => {
  const parsed = Proof.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
  try {
    const report = await findOwnedReport(parsed.data.reference, parsed.data.clientId);
    if (!report) return void res.status(404).json(NOT_FOUND);
    recordAuditEvent({ type: "privacy", title: "Data export", detail: `Data subject exported ${report.reference}`, reportReference: report.reference, targetId: report.id });
    res.setHeader("Content-Disposition", `attachment; filename="report-${report.reference}.json"`);
    res.json(await buildCitizenExport(report));
  } catch (err) {
    logger.error({ err }, "Citizen export failed");
    res.status(500).json({ error: "Export failed." });
  }
});

// Citizen: ask for my report's personal data to be erased (routed to the DPO).
router.post("/privacy/citizen-reports/erasure-request", privacyLimiter, async (req, res) => {
  const parsed = ErasureRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
  try {
    const report = await findOwnedReport(parsed.data.reference, parsed.data.clientId);
    if (!report) return void res.status(404).json(NOT_FOUND);
    res.status(202).json(await requestCitizenErasure(report, parsed.data.reason));
  } catch (err) {
    logger.error({ err }, "Erasure request failed");
    res.status(500).json({ error: "Request failed." });
  }
});

// Admin / DPO: execute an erasure (after checking no legal hold applies).
router.post("/admin/privacy/citizen-reports/:reference/erase", async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const reason = z.string().trim().min(3).max(300).safeParse(req.body?.reason);
  if (!reason.success) return void res.status(400).json({ error: "A reason (e.g. erasure request id) is required." });
  try {
    const report = await citizenReportStore.findByIdOrReference(String(req.params.reference));
    if (!report) return void res.status(404).json({ error: "Report not found." });
    const result = await eraseCitizenReport(report, reason.data);
    recordAuditEvent({
      type: "privacy",
      title: "Personal data erased",
      detail: `${admin.name} erased personal data of ${report.reference}: ${reason.data} (${result.evidenceDeleted} evidence items deleted)`,
      actorUserId: admin.sub,
      actorAgency: admin.agency,
      reportReference: report.reference,
      targetId: report.id,
      severity: "warning",
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "Erasure failed");
    res.status(500).json({ error: "Erasure failed." });
  }
});

// Staff: my own account data and activity (right of access).
router.get("/auth/me/data-export", privacyLimiter, async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const exported = await buildStaffExport(auth);
    res.setHeader("Content-Disposition", `attachment; filename="account-${auth.badgeNumber}.json"`);
    res.json({ ...exported, twoStepVerification: await getMfaStatus(auth.sub, auth.role) });
  } catch (err) {
    logger.error({ err }, "Staff export failed");
    res.status(500).json({ error: "Export failed." });
  }
});

export default router;
