import { randomUUID } from "node:crypto";
import type {
  CitizenAgencyRoute,
  CitizenReportSubmission,
  CitizenReportTimelineEntry,
  ReportStatus,
} from "@workspace/api-zod";

/**
 * Citizen report record returned to the mobile app. Field names mirror the
 * mobile `CitizenIncidentReceipt` model so responses map 1:1 with no transform.
 */
export interface CitizenReportRecord {
  id: string;
  reference: string;
  incidentType: CitizenReportSubmission["incidentType"];
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  state?: string;
  lga?: string;
  locationSource?: "gps" | "manual";
  accuracy?: number;
  photoUri?: string;
  vehicleRegistration?: string;
  emergencyLevel: CitizenReportSubmission["emergencyLevel"];
  /** Agency the report was originally routed to at submission time. */
  suggestedAgency: CitizenAgencyRoute;
  /** Current owning agency after any admin reassignment (may be a custom agency). */
  assignedAgency?: string;
  status: ReportStatus;
  submittedAt: string;
  timeline: CitizenReportTimelineEntry[];
}

export interface AgencyDashboardMetrics {
  total: number;
  submitted: number;
  triaged: number;
  assigned: number;
  in_progress: number;
  resolved: number;
  closed: number;
  rejected: number;
  highPriority: number;
  withCoordinates: number;
  withoutCoordinates: number;
}

/**
 * Persistence boundary for citizen reports. Today it is backed by an in-memory
 * array; swapping to Drizzle later only requires a new implementation of this
 * interface — route handlers do not change.
 */
export interface CitizenReportStore {
  create(input: CitizenReportSubmission): CitizenReportRecord;
  findByReference(reference: string): CitizenReportRecord | undefined;
  findByIdOrReference(idOrReference: string): CitizenReportRecord | undefined;
  list(): CitizenReportRecord[];
  listByAgency(agency: string): CitizenReportRecord[];
  updateStatus(
    idOrReference: string,
    status: ReportStatus,
    note: string | undefined,
    actorName: string | undefined,
  ): CitizenReportRecord | undefined;
  reassign(
    idOrReference: string,
    targetAgency: string,
    actorName: string | undefined,
  ): CitizenReportRecord | undefined;
  appendTimeline(
    idOrReference: string,
    action: string,
    actorName: string | undefined,
  ): CitizenReportRecord | undefined;
}

const AGENCY_LABELS: Record<string, string> = {
  frsc: "FRSC",
  police: "Police",
  vio: "VIO",
  civil_defence: "NSCDC",
  dss: "DSS",
  fire_service: "Fire Service",
  custom: "Agency",
};

function agencyLabel(agency: string): string {
  return AGENCY_LABELS[agency] ?? agency.toUpperCase();
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  submitted: "Submitted",
  triaged: "Triaged",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Rejected",
};

const STATUS_MESSAGES: Record<ReportStatus, string> = {
  submitted: "Your report has been received and is awaiting triage.",
  triaged: "Your report has been reviewed and prioritised.",
  assigned: "An officer has been assigned to your report.",
  in_progress: "Your report is being actioned by the responding agency.",
  resolved: "Your report has been resolved. Thank you for reporting.",
  closed: "Your report has been closed.",
  rejected: "Your report was reviewed and could not be actioned.",
};

export function citizenStatusMessage(status: ReportStatus): string {
  return STATUS_MESSAGES[status] ?? "Your report is being processed.";
}

/** The agency that currently owns the report (post-reassignment if any). */
export function currentAgency(report: CitizenReportRecord): string {
  return report.assignedAgency ?? report.suggestedAgency;
}

/**
 * Project a record into the response shape the mobile app maps directly onto
 * its `CitizenIncidentReceipt` model. `suggestedAgency` reflects the *current*
 * owning agency so reassignment is visible everywhere (lists, track, detail).
 */
export function toReportPayload(report: CitizenReportRecord) {
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
    suggestedAgency: currentAgency(report),
    status: report.status,
    submittedAt: report.submittedAt,
    timeline: report.timeline,
  };
}

export function agencyDashboardMetrics(reports: CitizenReportRecord[]): AgencyDashboardMetrics {
  const metrics: AgencyDashboardMetrics = {
    total: reports.length,
    submitted: 0,
    triaged: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    rejected: 0,
    highPriority: 0,
    withCoordinates: 0,
    withoutCoordinates: 0,
  };
  for (const report of reports) {
    metrics[report.status] += 1;
    if (report.emergencyLevel === "high" || report.emergencyLevel === "critical") {
      metrics.highPriority += 1;
    }
    if (hasCoordinates(report)) metrics.withCoordinates += 1;
    else metrics.withoutCoordinates += 1;
  }
  return metrics;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeReference(agency: CitizenAgencyRoute, sequence: number): string {
  const prefix = AGENCY_LABELS[agency]?.slice(0, 3).toUpperCase() ?? "CIR";
  const year = new Date().getUTCFullYear();
  return `CIR-${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

function hasCoordinates(input: { latitude?: number; longitude?: number }): boolean {
  return Number.isFinite(input.latitude) && Number.isFinite(input.longitude);
}

class InMemoryCitizenReportStore implements CitizenReportStore {
  private reports: CitizenReportRecord[] = [];
  private sequence = 0;

  create(input: CitizenReportSubmission): CitizenReportRecord {
    this.sequence += 1;
    const submittedAt = nowIso();
    const record: CitizenReportRecord = {
      id: randomUUID(),
      reference: makeReference(input.suggestedAgency, this.sequence),
      incidentType: input.incidentType,
      description: input.description,
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address ?? input.location,
      state: input.state,
      lga: input.lga,
      locationSource: input.locationSource ?? (hasCoordinates(input) ? "gps" : "manual"),
      accuracy: input.accuracy,
      photoUri: input.photoUri,
      vehicleRegistration: input.vehicleRegistration ?? input.vehicleRegistrationNumber,
      emergencyLevel: input.emergencyLevel,
      suggestedAgency: input.suggestedAgency,
      status: "submitted",
      submittedAt,
      timeline: [
        {
          id: `${randomUUID()}`,
          action: "Citizen report submitted",
          by: "Citizen",
          timestamp: submittedAt,
        },
      ],
    };
    this.reports.unshift(record);
    return record;
  }

  findByReference(reference: string): CitizenReportRecord | undefined {
    const target = reference.trim().toLowerCase();
    return this.reports.find((report) => report.reference.toLowerCase() === target);
  }

  findByIdOrReference(idOrReference: string): CitizenReportRecord | undefined {
    const target = idOrReference.trim().toLowerCase();
    return this.reports.find(
      (report) => report.id.toLowerCase() === target || report.reference.toLowerCase() === target,
    );
  }

  list(): CitizenReportRecord[] {
    return [...this.reports];
  }

  listByAgency(agency: string): CitizenReportRecord[] {
    const target = agency.trim().toLowerCase();
    return this.reports.filter((report) => currentAgency(report).toLowerCase() === target);
  }

  updateStatus(
    idOrReference: string,
    status: ReportStatus,
    note: string | undefined,
    actorName: string | undefined,
  ): CitizenReportRecord | undefined {
    const report = this.findByIdOrReference(idOrReference);
    if (!report) return undefined;
    report.status = status;
    const by = actorName ?? agencyLabel(currentAgency(report));
    report.timeline.push({
      id: randomUUID(),
      action: `${by} marked report ${STATUS_LABELS[status]}${note ? `: ${note}` : ""}`,
      by,
      timestamp: nowIso(),
    });
    return report;
  }

  reassign(
    idOrReference: string,
    targetAgency: string,
    actorName: string | undefined,
  ): CitizenReportRecord | undefined {
    const report = this.findByIdOrReference(idOrReference);
    if (!report) return undefined;
    const from = agencyLabel(currentAgency(report));
    report.assignedAgency = targetAgency;
    const by = actorName ?? "Admin";
    report.timeline.push({
      id: randomUUID(),
      action: `${by} reassigned report from ${from} to ${agencyLabel(targetAgency)}`,
      by,
      timestamp: nowIso(),
    });
    return report;
  }

  appendTimeline(
    idOrReference: string,
    action: string,
    actorName: string | undefined,
  ): CitizenReportRecord | undefined {
    const report = this.findByIdOrReference(idOrReference);
    if (!report) return undefined;
    report.timeline.push({
      id: randomUUID(),
      action,
      by: actorName ?? "Agency",
      timestamp: nowIso(),
    });
    return report;
  }
}

// Single shared instance for the process lifetime. Replace this construction
// with a Drizzle-backed implementation when DB persistence is ready.
export const citizenReportStore: CitizenReportStore = new InMemoryCitizenReportStore();
