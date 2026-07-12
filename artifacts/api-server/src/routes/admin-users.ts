import { Router, type IRouter, type Response } from "express";
import {
  AdminUserCreateSchema,
  AdminUserResetPinSchema,
  AdminUserUpdateSchema,
} from "@workspace/api-zod";
import {
  userRepository,
  type AdminUserFilter,
  type Role,
} from "../lib/auth";
import { requireAdmin } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ROLES: Role[] = ["citizen", "officer", "supervisor", "commander", "admin", "super_admin"];

function fail(res: Response, error: unknown) {
  logger.error({ err: error }, "Admin user request failed");
  res.status(500).json({ error: "Internal error processing the user request." });
}

/** Write operations require the DB-backed repository. */
function requireDbRepo(res: Response): boolean {
  if (userRepository.kind !== "db") {
    res.status(501).json({
      error: "User management requires the database (set DATABASE_URL). The demo repository is read-only.",
    });
    return false;
  }
  return true;
}

function isUniqueViolation(error: unknown): boolean {
  // Drizzle wraps the pg error (code 23505) as the `cause` of a query error.
  for (let cur: unknown = error; cur && typeof cur === "object"; cur = (cur as { cause?: unknown }).cause) {
    if ((cur as { code?: string }).code === "23505") return true;
  }
  return false;
}

// GET /api/admin/users — list users (admin only). Never returns PIN hashes.
router.get("/admin/users", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const q = req.query as Record<string, unknown>;
  const filter: AdminUserFilter = {};
  if (typeof q.agency === "string" && q.agency) filter.agency = q.agency;
  if (typeof q.role === "string" && ROLES.includes(q.role as Role)) filter.role = q.role as Role;
  if (typeof q.status === "string") {
    if (q.status === "active") filter.isActive = true;
    else if (q.status === "inactive" || q.status === "suspended") filter.isActive = false;
  }
  try {
    res.json({ users: await userRepository.listUsers(filter) });
  } catch (error) {
    fail(res, error);
  }
});

// POST /api/admin/users — create a user (admin only).
router.post("/admin/users", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = AdminUserCreateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  if (!requireDbRepo(res)) return;
  try {
    const user = await userRepository.createUser(result.data);
    res.status(201).json({ user });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: `Badge number ${result.data.badgeNumber.toUpperCase()} is already in use.` });
      return;
    }
    fail(res, error);
  }
});

// PATCH /api/admin/users/:userId — update safe fields (admin only).
router.patch("/admin/users/:userId", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = AdminUserUpdateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  if (!requireDbRepo(res)) return;
  try {
    const user = await userRepository.updateUser(req.params.userId, result.data);
    if (!user) {
      res.status(404).json({ error: `No user found for ${req.params.userId}` });
      return;
    }
    res.json({ user });
  } catch (error) {
    fail(res, error);
  }
});

// DELETE /api/admin/users/:userId — deactivate (soft delete), never a hard delete.
router.delete("/admin/users/:userId", async (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (req.params.userId === auth.sub) {
    res.status(400).json({ error: "You cannot deactivate your own account." });
    return;
  }
  if (!requireDbRepo(res)) return;
  try {
    const user = await userRepository.setActive(req.params.userId, false);
    if (!user) {
      res.status(404).json({ error: `No user found for ${req.params.userId}` });
      return;
    }
    res.json({ ok: true, user });
  } catch (error) {
    fail(res, error);
  }
});

// POST /api/admin/users/:userId/reset-pin — hash and store a new PIN (admin only).
router.post("/admin/users/:userId/reset-pin", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = AdminUserResetPinSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  if (!requireDbRepo(res)) return;
  try {
    const ok = await userRepository.resetPin(req.params.userId, result.data.pin);
    if (!ok) {
      res.status(404).json({ error: `No user found for ${req.params.userId}` });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
});

export default router;
