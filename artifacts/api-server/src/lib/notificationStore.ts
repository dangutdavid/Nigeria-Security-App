import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import {
  citizenNotifications,
  getDb,
  isDbConfigured,
  pushTokens,
  type Database,
} from "@workspace/db";
import type { NotificationCreate } from "@workspace/api-zod";
import { currentAgency, type CitizenReportRecord } from "./citizenReportStore";
import { logger } from "./logger";

/**
 * Notification record returned to the mobile app. Field names mirror the mobile
 * `AppNotification` model so responses map 1:1 with no transform.
 */
export interface NotificationRecord {
  id: string;
  type: string;
  audience: "citizen" | "agency" | "admin" | "user";
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
  agency?: string;
  userId?: string;
  role?: string;
  reportReference?: string;
  incidentId?: string;
  route?: string;
  priority: "low" | "normal" | "high" | "critical";
  sourceAgency?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationFilterInput {
  userId?: string;
  agency?: string;
  audience?: NotificationRecord["audience"];
  reportReference?: string;
}

export interface PushTokenRecord {
  token: string;
  platform?: string;
  userId?: string;
  agency?: string;
  createdAt: string;
}

/**
 * Persistence boundary for notifications and push tokens. In-memory today;
 * swapping to Drizzle later only requires a new implementation — routes and the
 * notify helpers below do not change.
 */
export interface NotificationStore {
  create(input: NotificationCreate): Promise<NotificationRecord>;
  list(filter: NotificationFilterInput): Promise<NotificationRecord[]>;
  markRead(id: string): Promise<boolean>;
  markAllRead(filter: NotificationFilterInput): Promise<number>;
  unreadCount(filter: NotificationFilterInput): Promise<number>;
  savePushToken(input: Omit<PushTokenRecord, "createdAt">): Promise<PushTokenRecord>;
  listPushTokens(filter: { userId?: string; agency?: string }): Promise<PushTokenRecord[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function matchesFilter(notification: NotificationRecord, filter: NotificationFilterInput): boolean {
  if (filter.reportReference) {
    if (notification.reportReference?.toUpperCase() !== filter.reportReference.toUpperCase()) return false;
    if (filter.audience && notification.audience !== filter.audience) return false;
    return true;
  }
  if (filter.audience === "admin" || filter.agency === "admin") {
    return notification.audience === "admin";
  }
  if (filter.agency) {
    return notification.audience === "agency" && notification.agency === filter.agency;
  }
  if (filter.userId) {
    return notification.userId === filter.userId;
  }
  if (filter.audience) {
    return notification.audience === filter.audience;
  }
  return false;
}

class InMemoryNotificationStore implements NotificationStore {
  private notifications: NotificationRecord[] = [];
  private tokens: PushTokenRecord[] = [];

  async create(input: NotificationCreate): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: input.id ?? randomUUID(),
      type: input.type,
      audience: input.audience,
      title: input.title,
      message: input.message,
      createdAt: input.createdAt ?? nowIso(),
      agency: input.agency,
      userId: input.userId,
      role: input.role,
      reportReference: input.reportReference,
      incidentId: input.incidentId,
      route: input.route,
      priority: input.priority ?? "normal",
      sourceAgency: input.sourceAgency,
      metadata: input.metadata,
    };
    this.notifications.unshift(record);
    return record;
  }

  async list(filter: NotificationFilterInput): Promise<NotificationRecord[]> {
    return this.notifications
      .filter((notification) => matchesFilter(notification, filter))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markRead(id: string): Promise<boolean> {
    const notification = this.notifications.find((item) => item.id === id);
    if (!notification) return false;
    if (!notification.readAt) notification.readAt = nowIso();
    return true;
  }

  async markAllRead(filter: NotificationFilterInput): Promise<number> {
    let count = 0;
    for (const notification of this.notifications) {
      if (!notification.readAt && matchesFilter(notification, filter)) {
        notification.readAt = nowIso();
        count += 1;
      }
    }
    return count;
  }

  async unreadCount(filter: NotificationFilterInput): Promise<number> {
    return this.notifications.filter(
      (notification) => !notification.readAt && matchesFilter(notification, filter),
    ).length;
  }

  async savePushToken(input: Omit<PushTokenRecord, "createdAt">): Promise<PushTokenRecord> {
    const existing = this.tokens.find((item) => item.token === input.token);
    if (existing) {
      existing.platform = input.platform;
      existing.userId = input.userId;
      existing.agency = input.agency;
      return existing;
    }
    const record: PushTokenRecord = { ...input, createdAt: nowIso() };
    this.tokens.push(record);
    return record;
  }

  async listPushTokens(filter: { userId?: string; agency?: string }): Promise<PushTokenRecord[]> {
    return this.tokens.filter(
      (t) =>
        (!filter.userId || t.userId === filter.userId) &&
        (!filter.agency || t.agency === filter.agency),
    );
  }
}

function notificationRow(row: typeof citizenNotifications.$inferSelect): NotificationRecord {
  return {
    id: row.id,
    type: row.type,
    audience: row.audience as NotificationRecord["audience"],
    title: row.title,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString(),
    agency: row.agency ?? undefined,
    userId: row.userId ?? undefined,
    role: row.role ?? undefined,
    reportReference: row.reportReference ?? undefined,
    incidentId: row.incidentId ?? undefined,
    route: row.route ?? undefined,
    priority: row.priority as NotificationRecord["priority"],
    sourceAgency: row.sourceAgency ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

/** SQL predicate mirroring matchesFilter(); `false` matches nothing. */
function notificationFilterSql(filter: NotificationFilterInput): SQL {
  if (filter.reportReference) {
    const ref = sql`upper(${citizenNotifications.reportReference}) = upper(${filter.reportReference})`;
    return filter.audience ? and(ref, eq(citizenNotifications.audience, filter.audience))! : ref;
  }
  if (filter.audience === "admin" || filter.agency === "admin") {
    return eq(citizenNotifications.audience, "admin");
  }
  if (filter.agency) {
    return and(eq(citizenNotifications.audience, "agency"), eq(citizenNotifications.agency, filter.agency))!;
  }
  if (filter.userId) {
    return eq(citizenNotifications.userId, filter.userId);
  }
  if (filter.audience) {
    return eq(citizenNotifications.audience, filter.audience);
  }
  return sql`false`;
}

class DrizzleNotificationStore implements NotificationStore {
  constructor(private readonly db: Database) {}

  async create(input: NotificationCreate): Promise<NotificationRecord> {
    const [row] = await this.db
      .insert(citizenNotifications)
      .values({
        type: input.type,
        audience: input.audience,
        title: input.title,
        message: input.message,
        agency: input.agency ?? null,
        userId: input.userId ?? null,
        role: input.role ?? null,
        reportReference: input.reportReference ?? null,
        incidentId: input.incidentId ?? null,
        route: input.route ?? null,
        priority: input.priority ?? "normal",
        sourceAgency: input.sourceAgency ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();
    return notificationRow(row);
  }

  async list(filter: NotificationFilterInput): Promise<NotificationRecord[]> {
    const rows = await this.db
      .select()
      .from(citizenNotifications)
      .where(notificationFilterSql(filter))
      .orderBy(desc(citizenNotifications.createdAt));
    return rows.map(notificationRow);
  }

  async markRead(id: string): Promise<boolean> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
    const rows = await this.db
      .update(citizenNotifications)
      .set({ readAt: new Date() })
      .where(and(eq(citizenNotifications.id, id), isNull(citizenNotifications.readAt)))
      .returning({ id: citizenNotifications.id });
    if (rows.length > 0) return true;
    const existing = await this.db
      .select({ id: citizenNotifications.id })
      .from(citizenNotifications)
      .where(eq(citizenNotifications.id, id))
      .limit(1);
    return existing.length > 0;
  }

  async markAllRead(filter: NotificationFilterInput): Promise<number> {
    const rows = await this.db
      .update(citizenNotifications)
      .set({ readAt: new Date() })
      .where(and(notificationFilterSql(filter), isNull(citizenNotifications.readAt)))
      .returning({ id: citizenNotifications.id });
    return rows.length;
  }

  async unreadCount(filter: NotificationFilterInput): Promise<number> {
    const [counted] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(citizenNotifications)
      .where(and(notificationFilterSql(filter), isNull(citizenNotifications.readAt)));
    return counted?.value ?? 0;
  }

  async savePushToken(input: Omit<PushTokenRecord, "createdAt">): Promise<PushTokenRecord> {
    const [row] = await this.db
      .insert(pushTokens)
      .values({
        token: input.token,
        platform: input.platform ?? null,
        userId: input.userId ?? null,
        agency: input.agency ?? null,
      })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: { platform: input.platform ?? null, userId: input.userId ?? null, agency: input.agency ?? null },
      })
      .returning();
    return {
      token: row.token,
      platform: row.platform ?? undefined,
      userId: row.userId ?? undefined,
      agency: row.agency ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listPushTokens(filter: { userId?: string; agency?: string }): Promise<PushTokenRecord[]> {
    const conditions: SQL[] = [];
    if (filter.userId) conditions.push(eq(pushTokens.userId, filter.userId));
    if (filter.agency) conditions.push(eq(pushTokens.agency, filter.agency));
    const rows = await this.db
      .select()
      .from(pushTokens)
      .where(conditions.length ? and(...conditions) : undefined);
    return rows.map((row) => ({
      token: row.token,
      platform: row.platform ?? undefined,
      userId: row.userId ?? undefined,
      agency: row.agency ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

function createNotificationStore(): NotificationStore {
  const db = getDb();
  if (db && isDbConfigured()) {
    logger.info("Notification store: PostgreSQL (Drizzle)");
    return new DrizzleNotificationStore(db);
  }
  logger.warn("Notification store: in-memory fallback (resets on restart)");
  return new InMemoryNotificationStore();
}

const baseNotificationStore = createNotificationStore();

/**
 * Public store: persists the notification, then mirrors it as an Expo push to
 * the matching registered devices (fire-and-forget; a push failure never
 * breaks the request). pushDispatch is imported lazily to avoid a module
 * cycle (pushDispatch reads tokens from this store).
 */
export const notificationStore: NotificationStore = {
  create: async (input) => {
    const record = await baseNotificationStore.create(input);
    void import("./pushDispatch")
      .then((m) => m.dispatchPushForNotification(record))
      .catch((err) => logger.warn({ err }, "Push dispatch import failed"));
    return record;
  },
  list: (filter) => baseNotificationStore.list(filter),
  markRead: (id) => baseNotificationStore.markRead(id),
  markAllRead: (filter) => baseNotificationStore.markAllRead(filter),
  unreadCount: (filter) => baseNotificationStore.unreadCount(filter),
  savePushToken: (input) => baseNotificationStore.savePushToken(input),
  listPushTokens: (filter) => baseNotificationStore.listPushTokens(filter),
};

// ---- Report event hooks (PART 5) ----------------------------------------------

const AGENCY_LABELS: Record<string, string> = {
  frsc: "FRSC",
  police: "Police",
  vio: "VIO",
  civil_defence: "NSCDC",
  dss: "DSS",
  fire_service: "Fire Service",
};

const AGENCY_ROUTES: Record<string, string> = {
  frsc: "/(tabs)/cases",
  police: "/(police)/crime-reports",
  vio: "/(vio)/inspections",
  civil_defence: "/(civil-defence)/incidents",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  triaged: "Triaged",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Rejected",
};

function agencyLabel(agency: string): string {
  return AGENCY_LABELS[agency] ?? agency.toUpperCase();
}

function agencyRoute(agency: string): string {
  return AGENCY_ROUTES[agency] ?? "/(tabs)/cases";
}

function priorityFromEmergency(level: string): NotificationRecord["priority"] {
  if (level === "critical") return "critical";
  if (level === "high") return "high";
  if (level === "medium") return "normal";
  return "low";
}

/** citizen report submitted → target agency notification (+ high-priority alert). */
export async function notifyReportSubmitted(report: CitizenReportRecord): Promise<void> {
  const agency = currentAgency(report);
  const priority = priorityFromEmergency(report.emergencyLevel);
  await notificationStore.create({
    type: "citizen_report_submitted",
    audience: "citizen",
    title: "Report submitted",
    message: `Your report ${report.reference} was submitted and routed to ${agencyLabel(agency)}.`,
    reportReference: report.reference,
    route: "/track-report",
    priority,
    sourceAgency: "citizen",
  });
  await notificationStore.create({
    type: "agency_referral_received",
    audience: "agency",
    agency,
    title: "New citizen report",
    message: `${report.reference} was routed to ${agencyLabel(agency)} (${report.incidentType.replace(/_/g, " ")}).`,
    reportReference: report.reference,
    route: agencyRoute(agency),
    priority,
    sourceAgency: "citizen",
  });
  if (report.emergencyLevel === "high" || report.emergencyLevel === "critical") {
    await notificationStore.create({
      type: "nearby_high_priority_alert",
      audience: "agency",
      agency,
      title: "High-priority citizen alert",
      message: `${report.reference} is marked ${report.emergencyLevel.toUpperCase()} at ${report.location}.`,
      reportReference: report.reference,
      route: agencyRoute(agency),
      priority,
      sourceAgency: "citizen",
    });
  }
}

/** status changed → citizen notification + owning-agency notification. */
export async function notifyStatusChanged(report: CitizenReportRecord, actorName: string | undefined): Promise<void> {
  const agency = currentAgency(report);
  const priority = priorityFromEmergency(report.emergencyLevel);
  const label = STATUS_LABELS[report.status] ?? report.status;
  const actor = actorName ?? agencyLabel(agency);
  await notificationStore.create({
    type: "status_changed",
    audience: "citizen",
    title: "Report status updated",
    message: `${report.reference} is now ${label}.`,
    reportReference: report.reference,
    route: "/track-report",
    priority,
    sourceAgency: "citizen",
  });
  await notificationStore.create({
    type: report.status === "assigned" ? "case_assigned" : "status_changed",
    audience: "agency",
    agency,
    title: report.status === "assigned" ? "Case assigned" : "Case status changed",
    message: `${report.reference} was marked ${label} by ${actor}.`,
    reportReference: report.reference,
    route: agencyRoute(agency),
    priority,
    sourceAgency: agency,
  });
}

/** report reassigned → target agency notification, citizen notification, admin history. */
export async function notifyReassigned(
  report: CitizenReportRecord,
  fromAgency: string,
  actorName: string | undefined,
): Promise<void> {
  const target = currentAgency(report);
  const priority = priorityFromEmergency(report.emergencyLevel);
  const actor = actorName ?? "Admin";
  await notificationStore.create({
    type: "report_reassigned",
    audience: "citizen",
    title: "Report reassigned",
    message: `${report.reference} has been reassigned to ${agencyLabel(target)} for handling.`,
    reportReference: report.reference,
    route: "/track-report",
    priority,
    sourceAgency: "admin",
  });
  await notificationStore.create({
    type: "report_reassigned",
    audience: "agency",
    agency: target,
    title: "Report reassigned to your agency",
    message: `${report.reference} was reassigned from ${agencyLabel(fromAgency)} to ${agencyLabel(target)} by ${actor}.`,
    reportReference: report.reference,
    route: agencyRoute(target),
    priority,
    sourceAgency: "admin",
  });
  await notificationStore.create({
    type: "admin_action",
    audience: "admin",
    agency: "admin",
    title: "Agency reassignment completed",
    message: `${actor} reassigned ${report.reference} from ${agencyLabel(fromAgency)} to ${agencyLabel(target)}.`,
    reportReference: report.reference,
    route: "/(admin)/incidents",
    priority: "normal",
    sourceAgency: "admin",
  });
}
