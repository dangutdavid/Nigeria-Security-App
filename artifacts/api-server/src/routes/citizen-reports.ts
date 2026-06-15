import { Router, type IRouter } from "express";
import { CitizenReportSubmissionSchema } from "@workspace/api-zod";
import {
  citizenReportStore,
  citizenStatusMessage,
  currentAgency,
  toReportPayload,
} from "../lib/citizenReportStore";

const router: IRouter = Router();

// PART 1 — Submit a citizen report.
router.post("/citizen-reports", (req, res) => {
  const result = CitizenReportSubmissionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }

  const report = citizenReportStore.create(result.data);
  res.status(201).json({
    report: toReportPayload(report),
    reference: report.reference,
    routedAgency: report.suggestedAgency,
  });
});

// PART 2 — Track a citizen report by its public reference number.
router.get("/citizen-reports/track/:reference", (req, res) => {
  const report = citizenReportStore.findByReference(req.params.reference);
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
});

// PART 3 — Report timeline / history.
router.get("/citizen-reports/:id/timeline", (req, res) => {
  const report = citizenReportStore.findByIdOrReference(req.params.id);
  if (!report) {
    res.status(404).json({ error: `No report found for ${req.params.id}` });
    return;
  }
  res.json({ reference: report.reference, timeline: report.timeline });
});

export default router;
