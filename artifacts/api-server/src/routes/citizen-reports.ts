import { Router, type IRouter, type Response } from "express";
import { CitizenReportSubmissionSchema } from "@workspace/api-zod";
import {
  citizenReportStore,
  citizenStatusMessage,
  currentAgency,
  toReportPayload,
} from "../lib/citizenReportStore";
import { notifyReportSubmitted } from "../lib/notificationStore";
import { rateLimit } from "../lib/rateLimit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const submitLimiter = rateLimit({
  name: "citizen_report_submit",
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Too many reports submitted from this device. Try again later.",
});

function fail(res: Response, error: unknown) {
  logger.error({ err: error }, "Citizen report request failed");
  res.status(500).json({ error: "Internal error processing the report request." });
}

// PART 1 — Submit a citizen report.
router.post("/citizen-reports", submitLimiter, async (req, res) => {
  const result = CitizenReportSubmissionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  try {
    const report = await citizenReportStore.create(result.data);
    await notifyReportSubmitted(report);
    res.status(201).json({
      report: toReportPayload(report),
      reference: report.reference,
      routedAgency: report.suggestedAgency,
    });
  } catch (error) {
    fail(res, error);
  }
});

// PART 2 — Track a citizen report by its public reference number.
router.get("/citizen-reports/track/:reference", async (req, res) => {
  try {
    const report = await citizenReportStore.findByReference(req.params.reference);
    if (!report) {
      res.status(404).json({ error: `No report found for reference ${req.params.reference}` });
      return;
    }
    res.json({
      reference: report.reference,
      report: toReportPayload(report),
      citizenMessage: citizenStatusMessage(report.status),
      currentAgency: currentAgency(report),
    });
  } catch (error) {
    fail(res, error);
  }
});

// PART 3 — Report timeline / history.
router.get("/citizen-reports/:id/timeline", async (req, res) => {
  try {
    const report = await citizenReportStore.findByIdOrReference(req.params.id);
    if (!report) {
      res.status(404).json({ error: `No report found for ${req.params.id}` });
      return;
    }
    res.json({ reference: report.reference, timeline: report.timeline });
  } catch (error) {
    fail(res, error);
  }
});

export default router;
