import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, citizenReportEvidence } from "@workspace/db";
import { logger } from "./logger";

export type EvidenceKind = "photo" | "video" | "audio" | "document" | "statement" | "other";

export interface EvidenceRecord {
  id: string;
  reportId: string;
  kind: EvidenceKind;
  uri: string;
  storageKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  uploadedBy?: string | null;
  metadata?: Record<string, unknown> | null;
  capturedAt?: string | null;
  createdAt: string;
}

export interface EvidenceCreateInput {
  reportId: string;
  kind: EvidenceKind;
  uri: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  uploadedBy?: string;
  metadata?: Record<string, unknown>;
  capturedAt?: string;
}

/**
 * Persistence boundary for citizen-report evidence metadata. DB-backed when
 * DATABASE_URL is set, else in-memory (explicit local-dev fallback — resets on
 * restart). Routes depend only on this interface.
 */
export interface EvidenceStore {
  create(input: EvidenceCreateInput): Promise<EvidenceRecord>;
  listByReport(reportId: string): Promise<EvidenceRecord[]>;
  findById(id: string): Promise<EvidenceRecord | undefined>;
  attachBinary(
    id: string,
    patch: { storageKey: string; mimeType?: string; sizeBytes: number; checksum: string },
  ): Promise<EvidenceRecord | undefined>;
}

function nowIso(): string {
  return new Date().toISOString();
}

class InMemoryEvidenceStore implements EvidenceStore {
  private readonly records: EvidenceRecord[] = [];

  async create(input: EvidenceCreateInput): Promise<EvidenceRecord> {
    const record: EvidenceRecord = {
      id: randomUUID(),
      ...input,
      createdAt: nowIso(),
    };
    this.records.push(record);
    return record;
  }

  async listByReport(reportId: string): Promise<EvidenceRecord[]> {
    return this.records.filter((r) => r.reportId === reportId);
  }

  async findById(id: string): Promise<EvidenceRecord | undefined> {
    return this.records.find((r) => r.id === id);
  }

  async attachBinary(
    id: string,
    patch: { storageKey: string; mimeType?: string; sizeBytes: number; checksum: string },
  ): Promise<EvidenceRecord | undefined> {
    const record = this.records.find((r) => r.id === id);
    if (!record) return undefined;
    record.storageKey = patch.storageKey;
    if (patch.mimeType) record.mimeType = patch.mimeType;
    record.sizeBytes = patch.sizeBytes;
    record.checksum = patch.checksum;
    return record;
  }
}

type EvidenceRow = typeof citizenReportEvidence.$inferSelect;

function rowToRecord(row: EvidenceRow): EvidenceRecord {
  return {
    id: row.id,
    reportId: row.reportId,
    kind: row.kind as EvidenceKind,
    uri: row.uri,
    storageKey: row.storageKey,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum,
    uploadedBy: row.uploadedBy,
    metadata: row.metadata ?? undefined,
    capturedAt: row.capturedAt ? row.capturedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

class DbEvidenceStore implements EvidenceStore {
  constructor(private readonly db: NonNullable<ReturnType<typeof getDb>>) {}

  async create(input: EvidenceCreateInput): Promise<EvidenceRecord> {
    const [row] = await this.db
      .insert(citizenReportEvidence)
      .values({
        reportId: input.reportId,
        kind: input.kind,
        uri: input.uri,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksum: input.checksum,
        uploadedBy: input.uploadedBy,
        metadata: input.metadata,
        capturedAt: input.capturedAt ? new Date(input.capturedAt) : undefined,
      })
      .returning();
    return rowToRecord(row);
  }

  async listByReport(reportId: string): Promise<EvidenceRecord[]> {
    const rows = await this.db
      .select()
      .from(citizenReportEvidence)
      .where(eq(citizenReportEvidence.reportId, reportId))
      .orderBy(citizenReportEvidence.createdAt);
    return rows.map(rowToRecord);
  }

  async findById(id: string): Promise<EvidenceRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(citizenReportEvidence)
      .where(eq(citizenReportEvidence.id, id))
      .limit(1);
    return row ? rowToRecord(row) : undefined;
  }

  async attachBinary(
    id: string,
    patch: { storageKey: string; mimeType?: string; sizeBytes: number; checksum: string },
  ): Promise<EvidenceRecord | undefined> {
    const [row] = await this.db
      .update(citizenReportEvidence)
      .set({
        storageKey: patch.storageKey,
        ...(patch.mimeType ? { mimeType: patch.mimeType } : {}),
        sizeBytes: patch.sizeBytes,
        checksum: patch.checksum,
      })
      .where(eq(citizenReportEvidence.id, id))
      .returning();
    return row ? rowToRecord(row) : undefined;
  }
}

function createEvidenceStore(): EvidenceStore {
  const db = getDb();
  if (db && isDbConfigured()) {
    logger.info("Evidence store: PostgreSQL (Drizzle)");
    return new DbEvidenceStore(db);
  }
  logger.warn("Evidence store: in-memory fallback (set DATABASE_URL to enable Postgres)");
  return new InMemoryEvidenceStore();
}

export const evidenceStore: EvidenceStore = createEvidenceStore();
