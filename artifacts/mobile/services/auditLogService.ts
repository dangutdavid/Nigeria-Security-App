import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AgencyType, UserRole } from "@/context/AuthContext";

export type AuditEventType =
  | "auth.login"
  | "auth.logout"
  | "auth.failed_login"
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.pin_reset"
  | "agency.created"
  | "agency.updated"
  | "report.submitted"
  | "report.status_changed"
  | "report.reassigned"
  | "notification.created";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditActor {
  id?: string;
  name: string;
  agency?: AgencyType;
  role?: UserRole;
}

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  title: string;
  detail: string;
  createdAt: string;
  severity: AuditSeverity;
  actor: AuditActor;
  agency?: AgencyType;
  targetId?: string;
  reportReference?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export type CreateAuditEventInput = Omit<AuditEvent, "id" | "createdAt" | "severity"> & {
  id?: string;
  createdAt?: string;
  severity?: AuditSeverity;
};

const AUDIT_STORAGE_KEY = "@security_audit_events_v1";
const MAX_AUDIT_EVENTS = 500;

function makeAuditId() {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readAuditEvents(): Promise<AuditEvent[]> {
  const raw = await AsyncStorage.getItem(AUDIT_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAuditEvents(events: AuditEvent[]) {
  await AsyncStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(events.slice(0, MAX_AUDIT_EVENTS)));
}

export async function createAuditEvent(input: CreateAuditEventInput): Promise<AuditEvent> {
  const event: AuditEvent = {
    ...input,
    id: input.id ?? makeAuditId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    severity: input.severity ?? "info",
  };
  const events = await readAuditEvents();
  await writeAuditEvents([event, ...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  return event;
}

export async function listAuditEvents(filter?: {
  agency?: AgencyType | "all";
  type?: AuditEventType | "all";
  severity?: AuditSeverity | "all";
  query?: string;
}): Promise<AuditEvent[]> {
  const events = await readAuditEvents();
  const q = filter?.query?.trim().toLowerCase();
  return events.filter((event) => {
    if (filter?.agency && filter.agency !== "all" && event.agency !== filter.agency && event.actor.agency !== filter.agency) return false;
    if (filter?.type && filter.type !== "all" && event.type !== filter.type) return false;
    if (filter?.severity && filter.severity !== "all" && event.severity !== filter.severity) return false;
    if (q) {
      const haystack = `${event.title} ${event.detail} ${event.actor.name} ${event.reportReference ?? ""} ${event.targetId ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function getAuditMetrics() {
  const events = await readAuditEvents();
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return {
    total: events.length,
    last24h: events.filter((event) => new Date(event.createdAt).getTime() >= since).length,
    warnings: events.filter((event) => event.severity === "warning").length,
    critical: events.filter((event) => event.severity === "critical").length,
  };
}
