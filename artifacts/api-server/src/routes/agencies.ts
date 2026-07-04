import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import {
  AgencyConflictError,
  agencyStore,
} from "../lib/agencyStore";
import { recordAuditEvent } from "../lib/auditStore";
import { requireAdmin } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function fail(res: Response, error: unknown) {
  logger.error({ err: error }, "Agency request failed");
  res.status(500).json({ error: "Internal error processing the agency request." });
}

const COLOR = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a #RRGGBB colour");

const AgencyCreateSchema = z.object({
  id: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/i).optional(),
  name: z.string().min(2).max(80),
  shortName: z.string().min(1).max(20),
  fullName: z.string().min(2).max(160),
  primaryColor: COLOR,
  secondaryColor: COLOR,
  badgePrefix: z.string().min(1).max(20),
  description: z.string().min(2).max(300),
  icon: z.string().max(40).optional(),
  isActive: z.boolean().optional(),
});

const AgencyUpdateSchema = AgencyCreateSchema.omit({ id: true }).partial();

// PART 1 — List the agency registry. Public: the mobile login screen needs the
// registry before any user is authenticated.
router.get("/agencies", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const records = await agencyStore.list(includeInactive);
    res.json({ agencies: records });
  } catch (error) {
    fail(res, error);
  }
});

// PART 2 — Create an agency registry entry (admin only).
router.post("/agencies", async (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  const parsed = AgencyCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  try {
    const record = await agencyStore.create(parsed.data);
    recordAuditEvent({
      type: "agency",
      title: "Agency created",
      detail: `${record.name} (${record.id}) added to the registry`,
      severity: "warning",
      actorUserId: auth.sub,
      actorAgency: auth.agency,
      targetId: record.id,
    });
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof AgencyConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    fail(res, error);
  }
});

// PART 3 — Update an agency registry entry (admin only).
router.patch("/agencies/:agency", async (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  const parsed = AgencyUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    return;
  }
  try {
    const record = await agencyStore.update(req.params.agency, parsed.data);
    if (!record) {
      res.status(404).json({ error: `No agency found for ${req.params.agency}` });
      return;
    }
    recordAuditEvent({
      type: "agency",
      title: "Agency updated",
      detail: `${record.name} (${record.id}) registry entry changed`,
      actorUserId: auth.sub,
      actorAgency: auth.agency,
      targetId: record.id,
      metadata: { fields: Object.keys(parsed.data) },
    });
    res.json(record);
  } catch (error) {
    fail(res, error);
  }
});

export default router;
