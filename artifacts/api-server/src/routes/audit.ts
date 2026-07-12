import { Router, type IRouter, type Response } from "express";
import { auditStore, type AuditSeverity } from "../lib/auditStore";
import { requireAdmin } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function fail(res: Response, error: unknown) {
  logger.error({ err: error }, "Audit request failed");
  res.status(500).json({ error: "Internal error processing the audit request." });
}

const SEVERITIES = new Set(["info", "warning", "critical"]);

function parseFilter(req: { query: Record<string, unknown> }) {
  const { type, severity, agency, limit } = req.query as Record<string, string | undefined>;
  return {
    type: type || undefined,
    severity: severity && SEVERITIES.has(severity) ? (severity as AuditSeverity) : undefined,
    agency: agency || undefined,
    limit: limit ? Math.min(Math.max(Number(limit) || 0, 1), 1000) : undefined,
  };
}

// PART 1 — Query audit events (admin only).
router.get("/audit-logs", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const auditLogs = await auditStore.list(parseFilter(req));
    res.json({ auditLogs });
  } catch (error) {
    fail(res, error);
  }
});

// PART 2 — CSV export (admin only).
router.get("/audit-logs/export", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await auditStore.list({ ...parseFilter(req), limit: 1000 });
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = "id,createdAt,type,severity,title,detail,actorUserId,actorAgency,targetId,reportReference";
    const csv = [
      header,
      ...rows.map((r) =>
        [r.id, r.createdAt, r.type, r.severity, r.title, r.detail, r.actorUserId, r.actorAgency, r.targetId, r.reportReference]
          .map(esc)
          .join(","),
      ),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="audit-logs.csv"');
    res.send(csv);
  } catch (error) {
    fail(res, error);
  }
});

export default router;
