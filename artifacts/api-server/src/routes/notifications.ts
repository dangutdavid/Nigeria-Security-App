import { Router, type IRouter, type Response } from "express";
import {
  NotificationCreateSchema,
  NotificationFilterSchema,
  PushTokenSchema,
} from "@workspace/api-zod";
import { notificationStore, type NotificationFilterInput } from "../lib/notificationStore";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function fail(res: Response, error: unknown) {
  logger.error({ err: error }, "Notification request failed");
  res.status(500).json({ error: "Internal error processing the notification request." });
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

// PART 1 — List notifications (filtered by agency / audience / userId / reportReference).
router.get("/notifications", async (req, res) => {
  try {
    const filter = filterFromQuery(req.query as Record<string, unknown>);
    res.json({ notifications: await notificationStore.list(filter) });
  } catch (error) {
    fail(res, error);
  }
});

// Create a notification (used by the mobile mock path / future producers).
router.post("/notifications", async (req, res) => {
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

// Unread count for a filter.
router.post("/notifications/unread-count", async (req, res) => {
  const result = NotificationFilterSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  try {
    res.json({ count: await notificationStore.unreadCount(result.data) });
  } catch (error) {
    fail(res, error);
  }
});

// Mark all matching notifications read.
router.patch("/notifications/read-all", async (req, res) => {
  const result = NotificationFilterSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  try {
    res.json({ ok: true, updated: await notificationStore.markAllRead(result.data) });
  } catch (error) {
    fail(res, error);
  }
});

// Mark a single notification read.
router.patch("/notifications/:id/read", async (req, res) => {
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

// PART 1 — Register a push token (no real delivery yet).
router.post("/push-tokens", async (req, res) => {
  const result = PushTokenSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }
  try {
    const record = await notificationStore.savePushToken(result.data);
    res.status(201).json({ ok: true, token: record.token });
  } catch (error) {
    fail(res, error);
  }
});

export default router;
