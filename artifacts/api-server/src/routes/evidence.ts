import express, { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { citizenReportStore, currentAgency } from "../lib/citizenReportStore";
import {
  evidenceStore,
  type EvidenceKind,
  type EvidenceRecord,
} from "../lib/evidenceStore";
import {
  createSignedDownload,
  evidenceStorage,
  sha256Hex,
  verifySignedDownload,
} from "../lib/evidenceStorage";
import { recordAuditEvent } from "../lib/auditStore";
import { getAuth, requireAgencyAccess } from "../middlewares/authMiddleware";
import { isAdminRole } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function fail(res: Response, error: unknown) {
  logger.error({ err: error }, "Evidence request failed");
  res.status(500).json({ error: "Internal error processing the evidence request." });
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "application/pdf",
]);

const EvidenceCreateSchema = z.object({
  kind: z.enum(["photo", "video", "audio", "document", "statement", "other"]),
  uri: z.string().min(1).max(2048),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  checksum: z.string().max(128).optional(),
  capturedAt: z.string().datetime({ offset: true }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function toEvidencePayload(record: EvidenceRecord) {
  return {
    id: record.id,
    reportId: record.reportId,
    kind: record.kind,
    uri: record.uri,
    fileName: record.fileName ?? undefined,
    mimeType: record.mimeType ?? undefined,
    sizeBytes: record.sizeBytes ?? undefined,
    checksum: record.checksum ?? undefined,
    uploadedByUserId: record.uploadedBy ?? undefined,
    metadata: record.metadata ?? undefined,
    capturedAt: record.capturedAt ?? undefined,
    createdAt: record.createdAt,
    hasBinary: Boolean(record.storageKey),
  };
}

// PART 1 — Create evidence metadata for a report. Public like report
// submission itself (citizens attach evidence when filing); authenticated
// users are recorded as the uploader.
router.post("/reports/:reportId/evidence", async (req, res) => {
  const parsed = EvidenceCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  try {
    const report = await citizenReportStore.findByIdOrReference(req.params.reportId);
    if (!report) {
      res.status(404).json({ error: `No report found for ${req.params.reportId}` });
      return;
    }
    const auth = getAuth(req);
    const record = await evidenceStore.create({
      reportId: report.id,
      kind: parsed.data.kind as EvidenceKind,
      uri: parsed.data.uri,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      checksum: parsed.data.checksum,
      capturedAt: parsed.data.capturedAt,
      metadata: parsed.data.metadata,
      uploadedBy: auth?.sub,
    });
    recordAuditEvent({
      type: "evidence",
      title: "Evidence metadata created",
      detail: `${parsed.data.kind} evidence added to ${report.reference}`,
      actorUserId: auth?.sub,
      actorAgency: auth?.agency,
      targetId: record.id,
      reportReference: report.reference,
    });
    res.status(201).json(toEvidencePayload(record));
  } catch (error) {
    fail(res, error);
  }
});

// PART 2 — Binary upload for previously created evidence metadata.
router.put(
  "/reports/:reportId/evidence/:evidenceId/content",
  express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
  async (req, res) => {
    try {
      const mimeType = req.header("content-type")?.split(";")[0]?.trim().toLowerCase();
      if (!mimeType || !ALLOWED_UPLOAD_MIME.has(mimeType)) {
        res.status(415).json({ error: `Unsupported evidence content type: ${mimeType ?? "unknown"}` });
        return;
      }
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: "Empty upload body." });
        return;
      }
      const record = await evidenceStore.findById(req.params.evidenceId);
      const report = await citizenReportStore.findByIdOrReference(req.params.reportId);
      if (!record || !report || record.reportId !== report.id) {
        res.status(404).json({ error: "Evidence metadata not found for this report." });
        return;
      }
      const storageKey = `${record.reportId}/${record.id}`;
      await evidenceStorage.put(storageKey, body);
      const updated = await evidenceStore.attachBinary(record.id, {
        storageKey,
        mimeType,
        sizeBytes: body.length,
        checksum: sha256Hex(body),
      });
      res.json(toEvidencePayload(updated ?? record));
    } catch (error) {
      fail(res, error);
    }
  },
);

// PART 3 — List evidence for a report (agency owner or admin).
router.get("/reports/:reportId/evidence", async (req, res) => {
  try {
    const report = await citizenReportStore.findByIdOrReference(req.params.reportId);
    if (!report) {
      res.status(404).json({ error: `No report found for ${req.params.reportId}` });
      return;
    }
    if (!requireAgencyAccess(req, res, currentAgency(report))) return;
    const records = await evidenceStore.listByReport(report.id);
    res.json({ evidence: records.map(toEvidencePayload) });
  } catch (error) {
    fail(res, error);
  }
});

// PART 4 — Mint a short-lived signed download URL (agency owner or admin).
router.get("/reports/:reportId/evidence/:evidenceId/download-url", async (req, res) => {
  try {
    const report = await citizenReportStore.findByIdOrReference(req.params.reportId);
    if (!report) {
      res.status(404).json({ error: `No report found for ${req.params.reportId}` });
      return;
    }
    const auth = requireAgencyAccess(req, res, currentAgency(report));
    if (!auth) return;
    const record = await evidenceStore.findById(req.params.evidenceId);
    if (!record || record.reportId !== report.id) {
      res.status(404).json({ error: "Evidence not found for this report." });
      return;
    }
    if (!record.storageKey) {
      res.status(409).json({ error: "No binary uploaded for this evidence yet." });
      return;
    }
    recordAuditEvent({
      type: "evidence",
      title: "Evidence download link issued",
      detail: `Signed download for evidence ${record.id} (${report.reference})`,
      actorUserId: auth.sub,
      actorAgency: auth.agency,
      targetId: record.id,
      reportReference: report.reference,
      metadata: { admin: isAdminRole(auth.role) },
    });
    res.json(createSignedDownload(record.id));
  } catch (error) {
    fail(res, error);
  }
});

// PART 5 — Signed download endpoint. Access is granted by the HMAC signature
// minted above, so no bearer token is needed (links can open in a browser).
router.get("/evidence-files/:evidenceId", async (req, res) => {
  try {
    const { exp, sig } = req.query as { exp?: string; sig?: string };
    if (!exp || !sig || !verifySignedDownload(req.params.evidenceId, exp, sig)) {
      res.status(403).json({ error: "Invalid or expired download link." });
      return;
    }
    const record = await evidenceStore.findById(req.params.evidenceId);
    if (!record?.storageKey) {
      res.status(404).json({ error: "Evidence binary not found." });
      return;
    }
    const stream = await evidenceStorage.createReadStream(record.storageKey);
    if (!stream) {
      res.status(404).json({ error: "Evidence binary not found in storage." });
      return;
    }
    res.setHeader("Content-Type", record.mimeType ?? "application/octet-stream");
    if (record.fileName) {
      res.setHeader("Content-Disposition", `attachment; filename="${record.fileName.replace(/"/g, "")}"`);
    }
    stream.pipe(res);
  } catch (error) {
    fail(res, error);
  }
});

export default router;
