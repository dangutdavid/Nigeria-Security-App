import { randomUUID, timingSafeEqual } from "node:crypto";
import { runAsSystem, setScopedLookup } from "@workspace/db";
import { auditStore, recordAuditEvent } from "./auditStore";
import { citizenReportStore, type CitizenReportRecord } from "./citizenReportStore";
import { evidenceStorage } from "./evidenceStorage";
import { evidenceStore } from "./evidenceStore";
import { notificationStore } from "./notificationStore";
import { logger } from "./logger";

/**
 * Data-subject rights for citizens (GDPR Arts. 15/17/20, NDPA ss.34-36,
 * PIPEDA Principle 9). Citizens report anonymously, so "who you are" is proven
 * by possession: the report reference PLUS the offline clientId that only the
 * submitting device holds. A reference alone (which may be shared, e.g. read
 * out to an officer) is not enough to export or erase.
 */
function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function findOwnedReport(reference: string, clientId: string): Promise<CitizenReportRecord | null> {
  await setScopedLookup("client_id", clientId); // RLS: only this device's report is visible
  const report = await citizenReportStore.findByReference(reference);
  if (!report?.clientId || !sameSecret(report.clientId, clientId)) return null;
  return report;
}

/** Machine-readable copy of everything held about the citizen's report (Art. 15/20). */
export async function buildCitizenExport(report: CitizenReportRecord) {
  const evidence = await evidenceStore.listByReport(report.id);
  return {
    exportedAt: new Date().toISOString(),
    controller: "Nigeria Safety & Security platform (see privacy notice for the data protection officer)",
    report,
    evidence: evidence.map(({ storageKey: _storageKey, ...meta }) => meta),
  };
}

/**
 * Erasure request. Reports are law-enforcement records, so erasure can be
 * restricted by a legal obligation or an open investigation (GDPR Art. 17(3),
 * NDPA s.3 exemptions). The request is therefore logged and routed to the data
 * protection officer / admins, who execute it with eraseCitizenReport() or
 * record why it is refused, within the statutory deadline (one month).
 */
export async function requestCitizenErasure(report: CitizenReportRecord, reason: string | undefined) {
  const requestId = randomUUID();
  recordAuditEvent({
    type: "privacy",
    title: "Erasure requested",
    detail: `Data subject requested erasure of ${report.reference} (request ${requestId})${reason ? `: ${reason.slice(0, 300)}` : ""}`,
    reportReference: report.reference,
    targetId: report.id,
    severity: "warning",
  });
  await notificationStore.create({
    type: "privacy_erasure_request",
    audience: "admin",
    title: "Data erasure request",
    message: `A citizen requested erasure of report ${report.reference}. Respond within one month.`,
    reportReference: report.reference,
    route: "/(admin)/audit",
    priority: "high",
    sourceAgency: "citizen",
  });
  return { requestId, status: "received" as const, respondWithinDays: 30 };
}

/**
 * Execute erasure: delete evidence binaries and rows, then anonymise the
 * report (statistics-safe fields are kept). Used by the admin endpoint and the
 * retention job. Irreversible.
 */
export async function eraseCitizenReport(report: CitizenReportRecord, reason: string): Promise<{ evidenceDeleted: number }> {
  const removed = await evidenceStore.deleteByReport(report.id);
  for (const item of removed) {
    if (!item.storageKey) continue;
    try {
      await evidenceStorage.delete(item.storageKey);
    } catch (err) {
      logger.error({ err, evidenceId: item.id }, "Evidence binary deletion failed — retry via retention job");
    }
  }
  await citizenReportStore.anonymize(report.id, reason);
  return { evidenceDeleted: removed.length };
}

/** Staff self-service access request: own profile and own activity trail. */
export async function buildStaffExport(user: { sub: string; name: string; badgeNumber: string; agency: string; role: string }) {
  // PRIVILEGE BOUNDARY: the audit trail is admin-read under RLS; a user may
  // receive the events they performed themselves (filtered by actor).
  const activity = await runAsSystem(() => auditStore.list({ actorUserId: user.sub, limit: 1000 }));
  return {
    exportedAt: new Date().toISOString(),
    account: { id: user.sub, name: user.name, badgeNumber: user.badgeNumber, agency: user.agency, role: user.role },
    activity,
  };
}
