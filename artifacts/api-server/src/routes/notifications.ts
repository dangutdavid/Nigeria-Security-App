import { Router, type IRouter, type Request, type Response } from "express";
import {
  NotificationCreateSchema,
  NotificationFilterSchema,
  PushTokenSchema,
} from "@workspace/api-zod";
import { notificationStore, type NotificationFilterInput } from "../lib/notificationStore";
import { logger } from "../lib/logger";
import { isAdminRole } from "../lib/auth";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function fail(res: Response, error: unknown) {
  logger.error({ err: error }, "Notification request failed");
  res.status(500).json({ error: "Internal error processing the notification request." });
}

/**
 * Authorize a notification filter and return the effective (scoped) filter, or
 * null if a 401/403 response was already sent.
 *
 * - Citizen-safe public path: a lookup by `reportReference` (citizen audience)
 *   needs no token, so the citizen track/notification flow keeps working.
 * - Otherwise auth is required: admins may query anything; agency users are
 *   limited to their own agency and cannot request admin notifications.
 */
function authorizeNotificationFilter(
  req: Request,
  res: Response,
  filter: NotificationFilterInput,
): NotificationFilterInput | null {
  if (filter.reportReference && (!filter.audience || filter.audience === "citizen")) {
    return { ...filter, audience: "citizen" };
  }
  const auth = requireAuth(req, res);
  if (!auth) return null;
  if (isAdminRole(auth.role)) return filter;
  if (filter.audience === "admin" || filter.agency === "admin") {
    res.status(403).json({ error: "Administrator access required." });
    return null;
  }
  if (filter.agency && filter.agency.toLowerCase() !== auth.agency.toLowerCase()) {
    res.status(403).json({ error: "You can only access your own agency's notifications." });
    return null;
  }
  return filter;
}

function filterFromQuery(query: Record<string, unknown>): NotificationFilterInput {
  const get = (key: string): string | undefined => {
    const value = query[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  };
  const audience = get("audience");
  return {
    userId: get("userId"),
    agency: get("agency"),
    audience:
      audience === "citizen" || audience === "agency" || audience === "admin" || audience === "user"
        ? audience
        : undefined,
    reportReference: get("reportReference"),
  };
}

// List notifications — citizen-by-reference is public; agency/admin require auth + scope.
router.get("/notifications", async (req, res) => {
  const filter = authorizeNotificationFilter(req, res, filterFromQuery(req.query as Record<string, unknown>));
  if (!filter) return;
  try {
    res.json({ notifications: await notificationStore.list(filter) });
  } catch (error) {
    fail(res, error);
  }
});

// Create a notification — requires auth (server creates report notifications via hooks).
router.post("/notifications", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const result = NotificationCreateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  try {
    res.status(201).json({ notification: await notificationStore.create(result.data) });
  } catch (error) {
    fail(res, error);
  }
});

// Unread count — same scoping as list.
router.post("/notifications/unread-count", async (req, res) => {
  const result = NotificationFilterSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  const filter = authorizeNotificationFilter(req, res, result.data);
  if (!filter) return;
  try {
    res.json({ count: await notificationStore.unreadCount(filter) });
  } catch (error) {
    fail(res, error);
  }
});

// Mark all matching notifications read — same scoping as list.
router.patch("/notifications/read-all", async (req, res) => {
  const result = NotificationFilterSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  const filter = authorizeNotificationFilter(req, res, result.data);
  if (!filter) return;
  try {
    res.json({ ok: true, updated: await notificationStore.markAllRead(filter) });
  } catch (error) {
    fail(res, error);
  }
});

// Mark a single notification read — requires an authenticated user.
router.patch("/notifications/:id/read", async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const found = await notificationStore.markRead(req.params.id);
    if (!found) {
      res.status(404).json({ error: `No notification found for ${req.params.id}` });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
});

// Register a push token — requires auth; associate with the authenticated user/agency.
router.post("/push-tokens", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const result = PushTokenSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  try {
    const record = await notificationStore.savePushToken({
      ...result.data,
      userId: auth.sub,
      agency: auth.agency,
    });
    res.status(201).json({ ok: true, token: record.token });
  } catch (error) {
    fail(res, error);
  }
});

export default router;
