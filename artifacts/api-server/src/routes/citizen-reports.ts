import { Router, type IRouter } from "express";
import { CitizenReportSubmissionSchema } from "@workspace/api-zod";
import {
  citizenReportStore,
  citizenStatusMessage,
  type CitizenReportRecord,
} from "../lib/citizenReportStore";

const router: IRouter = Router();

/**
 * Strip the record down to citizen-safe fields. The in-memory record only holds
 * citizen-submitted data plus the public timeline, but this keeps an explicit
 * boundary so officer/admin-only fields can never leak if the model grows.
 */
function toCitizenSafeReport(report: CitizenReportRecord) {
  return {
    id: report.id,
    reference: report.reference,
    incidentType: report.incidentType,
    description: report.description,
    location: report.location,
    latitude: report.latitude,
    longitude: report.longitude,
    address: report.address,
    state: report.state,
    lga: report.lga,
    locationSource: report.locationSource,
    accuracy: report.accuracy,
    photoUri: report.photoUri,
    vehicleRegistration: report.vehicleRegistration,
    emergencyLevel: report.emergencyLevel,
    suggestedAgency: report.suggestedAgency,
    status: report.status,
    submittedAt: report.submittedAt,
    timeline: report.timeline,
  };
}

// PART 1 — Submit a citizen report.
router.post("/citizen-reports", (req, res) => {
  const result = CitizenReportSubmissionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }

  const report = citizenReportStore.create(result.data);
  res.status(201).json({
    report: toCitizenSafeReport(report),
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
    report: toCitizenSafeReport(report),
    citizenMessage: citizenStatusMessage(report.status),
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
