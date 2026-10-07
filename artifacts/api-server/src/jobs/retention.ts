import { lt } from "drizzle-orm";
import { auditEvents, citizenNotifications, getDb, isDbConfigured, revokedTokens, runAsSystem } from "@workspace/db";
import { ANONYMIZED_TEXT, citizenReportStore } from "../lib/citizenReportStore";
import { eraseCitizenReport } from "../lib/privacy";
import { envInt } from "../lib/rateLimit";
import { logger } from "../lib/logger";

/**
 * Storage limitation (GDPR Art. 5(1)(e), NDPA s.24(1)(d), PIPEDA 4.5): data is
 * kept no longer than needed. Run daily (cron / systemd timer — see
 * deploy/liquidweb). Defaults are conservative and MUST be confirmed against
 * the agencies' records-retention schedules:
 *
 *   CITIZEN_REPORT_RETENTION_DAYS  2555 (7y)  closed/resolved/rejected reports → anonymised
 *   NOTIFICATION_RETENTION_DAYS     365       in-app notifications → deleted
 *   AUDIT_RETENTION_DAYS           2190 (6y)  audit trail → deleted (HIPAA keeps 6 years)
 *
 * Runs as 'system' — the only role the audit immutability trigger allows to delete.
 */
export interface RetentionResult {
  reportsAnonymized: number;
  evidenceDeleted: number;
  notificationsDeleted: number;
  auditEventsDeleted: number;
  revokedTokensDeleted: number;
}


export async function runRetention(now = new Date()): Promise<RetentionResult> {
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const result: RetentionResult = { reportsAnonymized: 0, evidenceDeleted: 0, notificationsDeleted: 0, auditEventsDeleted: 0, revokedTokensDeleted: 0 };
  const reportCutoff = daysAgo(envInt("CITIZEN_REPORT_RETENTION_DAYS", 2555));

  // Closed reports past retention (both storage modes, via the store API).
  const expired = (await citizenReportStore.list()).filter(
    (r) =>
      ["closed", "resolved", "rejected"].includes(r.status) &&
      new Date(r.submittedAt) < reportCutoff &&
      r.description !== ANONYMIZED_TEXT,
  );
  for (const report of expired) {
    const { evidenceDeleted } = await eraseCitizenReport(report, "retention period elapsed");
    result.reportsAnonymized += 1;
    result.evidenceDeleted += evidenceDeleted;
  }

  const db = getDb();
  if (db && isDbConfigured()) {
    result.notificationsDeleted = (
      await db.delete(citizenNotifications).where(lt(citizenNotifications.createdAt, daysAgo(envInt("NOTIFICATION_RETENTION_DAYS", 365)))).returning({ id: citizenNotifications.id })
    ).length;
    result.auditEventsDeleted = (
      await db.delete(auditEvents).where(lt(auditEvents.createdAt, daysAgo(envInt("AUDIT_RETENTION_DAYS", 2190)))).returning({ id: auditEvents.id })
    ).length;
    result.revokedTokensDeleted = (
      await db.delete(revokedTokens).where(lt(revokedTokens.expiresAt, now)).returning({ jti: revokedTokens.jti })
    ).length;
  }
  return result;
}

/** CLI entry (dist/retention.mjs): runs once as system and logs a summary. */
export async function main(): Promise<void> {
  const result = await runAsSystem(() => runRetention());
  logger.info({ ...result }, "Retention run complete");
}

