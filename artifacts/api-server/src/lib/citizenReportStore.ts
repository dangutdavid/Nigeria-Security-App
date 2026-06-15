import { randomUUID } from "node:crypto";
import type {
  CitizenAgencyRoute,
  CitizenIncidentStatus,
  CitizenReportSubmission,
  CitizenReportTimelineEntry,
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
  suggestedAgency: CitizenAgencyRoute;
  status: CitizenIncidentStatus;
  submittedAt: string;
  timeline: CitizenReportTimelineEntry[];
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
}

const AGENCY_LABELS: Record<CitizenAgencyRoute, string> = {
  frsc: "FRSC",
  police: "Police",
  vio: "VIO",
  civil_defence: "NSCDC",
};

const STATUS_MESSAGES: Record<CitizenIncidentStatus, string> = {
  submitted: "Your report has been received and is awaiting triage.",
  triaged: "Your report has been reviewed and prioritised.",
  assigned: "An officer has been assigned to your report.",
  in_progress: "Your report is being actioned by the responding agency.",
  resolved: "Your report has been resolved. Thank you for reporting.",
  closed: "Your report has been closed.",
};

export function citizenStatusMessage(status: CitizenIncidentStatus): string {
  return STATUS_MESSAGES[status] ?? "Your report is being processed.";
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
}

// Single shared instance for the process lifetime. Replace this construction
// with a Drizzle-backed implementation when DB persistence is ready.
export const citizenReportStore: CitizenReportStore = new InMemoryCitizenReportStore();
