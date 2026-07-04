import { randomUUID } from "node:crypto";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { getDb, isDbConfigured, auditEvents } from "@workspace/db";
import { logger } from "./logger";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditEventRecord {
  id: string;
  type: string;
  title: string;
  detail: string;
  severity: AuditSeverity;
  actorUserId?: string | null;
  actorAgency?: string | null;
  targetId?: string | null;
  reportReference?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditEventInput {
  type: string;
  title: string;
  detail: string;
  severity?: AuditSeverity;
  actorUserId?: string;
  actorAgency?: string;
  targetId?: string;
  reportReference?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditFilter {
  type?: string;
  severity?: AuditSeverity;
  agency?: string;
  limit?: number;
}

/**
 * Persistence boundary for the flat audit trail. DB-backed when DATABASE_URL
 * is set, else in-memory (explicit local-dev fallback — resets on restart).
 */
export interface AuditStore {
  record(input: AuditEventInput): Promise<AuditEventRecord>;
  list(filter?: AuditFilter): Promise<AuditEventRecord[]>;
}

const DEFAULT_LIMIT = 200;

class InMemoryAuditStore implements AuditStore {
  private readonly records: AuditEventRecord[] = [];

  async record(input: AuditEventInput): Promise<AuditEventRecord> {
    const record: AuditEventRecord = {
      id: randomUUID(),
      severity: "info",
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.records.unshift(record);
    return record;
  }

  async list(filter?: AuditFilter): Promise<AuditEventRecord[]> {
    return this.records
      .filter(
        (r) =>
          (!filter?.type || r.type === filter.type) &&
          (!filter?.severity || r.severity === filter.severity) &&
          (!filter?.agency || r.actorAgency === filter.agency),
      )
      .slice(0, filter?.limit ?? DEFAULT_LIMIT);
  }
}

type AuditRow = typeof auditEvents.$inferSelect;

function rowToRecord(row: AuditRow): AuditEventRecord {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    detail: row.detail,
    severity: row.severity as AuditSeverity,
    actorUserId: row.actorUserId,
    actorAgency: row.actorAgency,
    targetId: row.targetId,
    reportReference: row.reportReference,
    metadata: row.metadata ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

class DbAuditStore implements AuditStore {
  constructor(private readonly db: NonNullable<ReturnType<typeof getDb>>) {}

  async record(input: AuditEventInput): Promise<AuditEventRecord> {
    const [row] = await this.db
      .insert(auditEvents)
      .values({
        type: input.type,
        title: input.title,
        detail: input.detail,
        severity: input.severity ?? "info",
        actorUserId: input.actorUserId,
        actorAgency: input.actorAgency,
        targetId: input.targetId,
        reportReference: input.reportReference,
        metadata: input.metadata,
      })
      .returning();
    return rowToRecord(row);
  }

  async list(filter?: AuditFilter): Promise<AuditEventRecord[]> {
    const conditions: SQL[] = [];
    if (filter?.type) conditions.push(eq(auditEvents.type, filter.type));
    if (filter?.severity) conditions.push(eq(auditEvents.severity, filter.severity));
    if (filter?.agency) conditions.push(eq(auditEvents.actorAgency, filter.agency));
    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditEvents.createdAt))
      .limit(filter?.limit ?? DEFAULT_LIMIT);
    return rows.map(rowToRecord);
  }
}

function createAuditStore(): AuditStore {
  const db = getDb();
  if (db && isDbConfigured()) {
    logger.info("Audit store: PostgreSQL (Drizzle)");
    return new DbAuditStore(db);
  }
  logger.warn("Audit store: in-memory fallback (set DATABASE_URL to enable Postgres)");
  return new InMemoryAuditStore();
}

export const auditStore: AuditStore = createAuditStore();

/**
 * Fire-and-forget audit recording — never lets an audit failure break the
 * user-facing request.
 */
export function recordAuditEvent(input: AuditEventInput): void {
  void auditStore.record(input).catch((err) => {
    logger.warn({ err, type: input.type }, "Failed to record audit event");
  });
}
