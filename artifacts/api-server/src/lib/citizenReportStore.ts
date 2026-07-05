import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import {
  citizenReports,
  getDb,
  isDbConfigured,
  type Database,
} from "@workspace/db";
import type {
  CitizenAgencyRoute,
  CitizenReportSubmission,
  CitizenReportTimelineEntry,
  ReportStatus,
} from "@workspace/api-zod";
import { logger } from "./logger";

/**
 * Citizen report record returned to the mobile app. Field names mirror the
 * mobile `CitizenIncidentReceipt` model so responses map 1:1 with no transform.
 */
export interface CitizenReportRecord {
  id: string;
  reference: string;
  /** Client-generated idempotency key (present when submitted with one). */
  clientId?: string;
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
  create(input: CitizenReportSubmission): Promise<CitizenReportRecord>;
  findByReference(reference: string): Promise<CitizenReportRecord | undefined>;
  findByIdOrReference(idOrReference: string): Promise<CitizenReportRecord | undefined>;
  list(): Promise<CitizenReportRecord[]>;
  listByAgency(agency: string): Promise<CitizenReportRecord[]>;
  updateStatus(
    idOrReference: string,
    status: ReportStatus,
    note: string | undefined,
    actorName: string | undefined,
  ): Promise<CitizenReportRecord | undefined>;
  reassign(
    idOrReference: string,
    targetAgency: string,
    actorName: string | undefined,
  ): Promise<CitizenReportRecord | undefined>;
  appendTimeline(
    idOrReference: string,
    action: string,
    actorName: string | undefined,
  ): Promise<CitizenReportRecord | undefined>;
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function initialTimeline(submittedAt: string): CitizenReportTimelineEntry[] {
  return [{ id: randomUUID(), action: "Citizen report submitted", by: "Citizen", timestamp: submittedAt }];
}

function statusTimelineEntry(
  report: CitizenReportRecord,
  status: ReportStatus,
  note: string | undefined,
  actorName: string | undefined,
): CitizenReportTimelineEntry {
  const by = actorName ?? agencyLabel(currentAgency(report));
  return {
    id: randomUUID(),
    action: `${by} marked report ${STATUS_LABELS[status]}${note ? `: ${note}` : ""}`,
    by,
    timestamp: nowIso(),
  };
}

function reassignTimelineEntry(
  report: CitizenReportRecord,
  targetAgency: string,
  actorName: string | undefined,
): CitizenReportTimelineEntry {
  const from = agencyLabel(currentAgency(report));
  const by = actorName ?? "Admin";
  return {
    id: randomUUID(),
    action: `${by} reassigned report from ${from} to ${agencyLabel(targetAgency)}`,
    by,
    timestamp: nowIso(),
  };
}

class InMemoryCitizenReportStore implements CitizenReportStore {
  private reports: CitizenReportRecord[] = [];
  private sequence = 0;

  async create(input: CitizenReportSubmission): Promise<CitizenReportRecord> {
    // Idempotency: a retry carrying the same clientId returns the original.
    if (input.clientId) {
      const existing = this.reports.find((r) => r.clientId === input.clientId);
      if (existing) return existing;
    }
    this.sequence += 1;
    const submittedAt = nowIso();
    const record: CitizenReportRecord = {
      id: randomUUID(),
      clientId: input.clientId,
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
      timeline: initialTimeline(submittedAt),
    };
    this.reports.unshift(record);
    return record;
  }

  async findByReference(reference: string): Promise<CitizenReportRecord | undefined> {
    const target = reference.trim().toLowerCase();
    return this.reports.find((report) => report.reference.toLowerCase() === target);
  }

  async findByIdOrReference(idOrReference: string): Promise<CitizenReportRecord | undefined> {
    const target = idOrReference.trim().toLowerCase();
    return this.reports.find(
      (report) => report.id.toLowerCase() === target || report.reference.toLowerCase() === target,
    );
  }

  async list(): Promise<CitizenReportRecord[]> {
    return [...this.reports];
  }

  async listByAgency(agency: string): Promise<CitizenReportRecord[]> {
    const target = agency.trim().toLowerCase();
    return this.reports.filter((report) => currentAgency(report).toLowerCase() === target);
  }

  async updateStatus(
    idOrReference: string,
    status: ReportStatus,
    note: string | undefined,
    actorName: string | undefined,
  ): Promise<CitizenReportRecord | undefined> {
    const report = await this.findByIdOrReference(idOrReference);
    if (!report) return undefined;
    report.timeline.push(statusTimelineEntry(report, status, note, actorName));
    report.status = status;
    return report;
  }

  async reassign(
    idOrReference: string,
    targetAgency: string,
    actorName: string | undefined,
  ): Promise<CitizenReportRecord | undefined> {
    const report = await this.findByIdOrReference(idOrReference);
    if (!report) return undefined;
    report.timeline.push(reassignTimelineEntry(report, targetAgency, actorName));
    report.assignedAgency = targetAgency;
    return report;
  }

  async appendTimeline(
    idOrReference: string,
    action: string,
    actorName: string | undefined,
  ): Promise<CitizenReportRecord | undefined> {
    const report = await this.findByIdOrReference(idOrReference);
    if (!report) return undefined;
    report.timeline.push({ id: randomUUID(), action, by: actorName ?? "Agency", timestamp: nowIso() });
    return report;
  }
}

function mapRow(row: typeof citizenReports.$inferSelect): CitizenReportRecord {
  return {
    id: row.id,
    reference: row.reference,
    clientId: row.clientId ?? undefined,
    incidentType: row.incidentType as CitizenReportRecord["incidentType"],
    description: row.description,
    location: row.location,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    address: row.address ?? undefined,
    state: row.state ?? undefined,
    lga: row.lga ?? undefined,
    locationSource: (row.locationSource as "gps" | "manual" | null) ?? undefined,
    accuracy: row.accuracy ?? undefined,
    photoUri: row.photoUri ?? undefined,
    vehicleRegistration: row.vehicleRegistration ?? undefined,
    emergencyLevel: row.emergencyLevel as CitizenReportRecord["emergencyLevel"],
    suggestedAgency: row.suggestedAgency as CitizenAgencyRoute,
    assignedAgency: row.assignedAgency ?? undefined,
    status: row.status,
    submittedAt: new Date(row.submittedAt).toISOString(),
    timeline: row.timeline ?? [],
  };
}

class DrizzleCitizenReportStore implements CitizenReportStore {
  constructor(private readonly db: Database) {}

  async create(input: CitizenReportSubmission): Promise<CitizenReportRecord> {
    // Idempotency: a retry carrying the same clientId returns the original
    // report instead of creating a duplicate (unique index on client_id).
    if (input.clientId) {
      const [existing] = await this.db
        .select()
        .from(citizenReports)
        .where(eq(citizenReports.clientId, input.clientId))
        .limit(1);
      if (existing) return mapRow(existing);
    }
    const [counted] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(citizenReports);
    const sequence = (counted?.value ?? 0) + 1;
    const submittedAt = new Date();
    const [row] = await this.db
      .insert(citizenReports)
      .values({
        reference: makeReference(input.suggestedAgency, sequence),
        clientId: input.clientId ?? null,
        incidentType: input.incidentType,
        description: input.description,
        emergencyLevel: input.emergencyLevel,
        suggestedAgency: input.suggestedAgency,
        status: "submitted",
        location: input.location,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        address: input.address ?? input.location,
        state: input.state ?? null,
        lga: input.lga ?? null,
        locationSource: input.locationSource ?? (hasCoordinates(input) ? "gps" : "manual"),
        accuracy: input.accuracy ?? null,
        vehicleRegistration: input.vehicleRegistration ?? input.vehicleRegistrationNumber ?? null,
        photoUri: input.photoUri ?? null,
        timeline: initialTimeline(submittedAt.toISOString()),
      })
      .returning();
    return mapRow(row);
  }

  async findByReference(reference: string): Promise<CitizenReportRecord | undefined> {
    const rows = await this.db
      .select()
      .from(citizenReports)
      .where(sql`lower(${citizenReports.reference}) = lower(${reference})`)
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : undefined;
  }

  async findByIdOrReference(idOrReference: string): Promise<CitizenReportRecord | undefined> {
    const byReference = await this.findByReference(idOrReference);
    if (byReference) return byReference;
    if (isUuid(idOrReference)) {
      const rows = await this.db
        .select()
        .from(citizenReports)
        .where(eq(citizenReports.id, idOrReference.trim()))
        .limit(1);
      if (rows[0]) return mapRow(rows[0]);
    }
    return undefined;
  }

  async list(): Promise<CitizenReportRecord[]> {
    const rows = await this.db.select().from(citizenReports).orderBy(desc(citizenReports.submittedAt));
    return rows.map(mapRow);
  }

  async listByAgency(agency: string): Promise<CitizenReportRecord[]> {
    const rows = await this.db
      .select()
      .from(citizenReports)
      .where(
        sql`lower(coalesce(${citizenReports.assignedAgency}, ${citizenReports.suggestedAgency})) = lower(${agency})`,
      )
      .orderBy(desc(citizenReports.submittedAt));
    return rows.map(mapRow);
  }

  async updateStatus(
    idOrReference: string,
    status: ReportStatus,
    note: string | undefined,
    actorName: string | undefined,
  ): Promise<CitizenReportRecord | undefined> {
    const report = await this.findByIdOrReference(idOrReference);
    if (!report) return undefined;
    const timeline = [...report.timeline, statusTimelineEntry(report, status, note, actorName)];
    const [row] = await this.db
      .update(citizenReports)
      .set({ status, timeline, updatedAt: sql`now()` })
      .where(eq(citizenReports.id, report.id))
      .returning();
    return row ? mapRow(row) : undefined;
  }

  async reassign(
    idOrReference: string,
    targetAgency: string,
    actorName: string | undefined,
  ): Promise<CitizenReportRecord | undefined> {
    const report = await this.findByIdOrReference(idOrReference);
    if (!report) return undefined;
    const timeline = [...report.timeline, reassignTimelineEntry(report, targetAgency, actorName)];
    const [row] = await this.db
      .update(citizenReports)
      .set({ assignedAgency: targetAgency, timeline, updatedAt: sql`now()` })
      .where(eq(citizenReports.id, report.id))
      .returning();
    return row ? mapRow(row) : undefined;
  }

  async appendTimeline(
    idOrReference: string,
    action: string,
    actorName: string | undefined,
  ): Promise<CitizenReportRecord | undefined> {
    const report = await this.findByIdOrReference(idOrReference);
    if (!report) return undefined;
    const timeline = [
      ...report.timeline,
      { id: randomUUID(), action, by: actorName ?? "Agency", timestamp: nowIso() },
    ];
    const [row] = await this.db
      .update(citizenReports)
      .set({ timeline, updatedAt: sql`now()` })
      .where(eq(citizenReports.id, report.id))
      .returning();
    return row ? mapRow(row) : undefined;
  }
}

function createCitizenReportStore(): CitizenReportStore {
  const db = getDb();
  if (db && isDbConfigured()) {
    logger.info("Citizen report store: PostgreSQL (Drizzle)");
    return new DrizzleCitizenReportStore(db);
  }
  logger.warn(
    "Citizen report store: in-memory fallback (set DATABASE_URL to enable Postgres; in-memory data resets on restart)",
  );
  return new InMemoryCitizenReportStore();
}

// Selected once at startup: DB-backed when DATABASE_URL is set, else in-memory.
export const citizenReportStore: CitizenReportStore = createCitizenReportStore();
