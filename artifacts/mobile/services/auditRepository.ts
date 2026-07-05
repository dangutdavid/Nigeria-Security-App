import type { AgencyType } from "@/context/AuthContext";
import { mobileApiFetch } from "@/services/apiClient";
import { shouldUseApi } from "@/services/apiConfig";
import {
  listAuditEvents as listLocalAuditEvents,
  type AuditEvent,
  type AuditEventType,
  type AuditSeverity,
} from "@/services/auditLogService";

/**
 * API-first audit trail access for the admin screen: reads the persisted
 * backend trail (GET /audit-logs, admin token required) and falls back to the
 * local AsyncStorage log in local/offline mode.
 */

interface ServerAuditEvent {
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

// Backend event categories → closest mobile audit type (used for icons).
const TYPE_MAP: Record<string, AuditEventType> = {
  auth: "auth.login",
  report: "report.status_changed",
  agency: "agency.updated",
  evidence: "report.submitted",
  referral: "report.reassigned",
  user: "user.updated",
};

function toAuditEvent(server: ServerAuditEvent): AuditEvent {
  return {
    id: server.id,
    type: TYPE_MAP[server.type] ?? "notification.created",
    title: server.title,
    detail: server.detail,
    createdAt: server.createdAt,
    severity: server.severity,
    actor: {
      id: server.actorUserId ?? undefined,
      name: server.actorUserId ? "Agency user" : "System",
      agency: (server.actorAgency ?? undefined) as AgencyType | undefined,
    },
    agency: (server.actorAgency ?? undefined) as AgencyType | undefined,
    targetId: server.targetId ?? undefined,
    reportReference: server.reportReference ?? undefined,
    metadata: server.metadata as AuditEvent["metadata"],
  };
}

export async function listAuditEvents(filter?: {
  agency?: AgencyType | "all";
  type?: AuditEventType | "all";
  severity?: AuditSeverity | "all";
  query?: string;
}): Promise<AuditEvent[]> {
  const params = new URLSearchParams();
  if (filter?.severity && filter.severity !== "all") params.set("severity", filter.severity);
  if (filter?.agency && filter.agency !== "all") params.set("agency", filter.agency);
  const qs = params.toString();

  const api = await mobileApiFetch<{ auditLogs?: ServerAuditEvent[] }>({
    method: "GET",
    path: `/audit-logs${qs ? `?${qs}` : ""}`,
    requireAuth: true,
  });

  if (api.ok && api.data.auditLogs) {
    let events = api.data.auditLogs.map(toAuditEvent);
    const q = filter?.query?.trim().toLowerCase();
    if (q) {
      events = events.filter((e) =>
        `${e.title} ${e.detail} ${e.reportReference ?? ""} ${e.targetId ?? ""}`.toLowerCase().includes(q),
      );
    }
    return events;
  }

  if (!api.ok && shouldUseApi()) {
    console.warn(`[auditRepository] fell back to local audit log: ${api.error}`);
  }
  return listLocalAuditEvents(filter);
}
