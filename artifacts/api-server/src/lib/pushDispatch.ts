import { notificationStore, type NotificationRecord } from "./notificationStore";
import { sendPushToTokens, type PushMessage } from "./pushSender";
import { logger } from "./logger";

/**
 * Targeting layer between stored push tokens and the raw Expo sender. Kept
 * separate from notificationStore/pushSender to avoid import cycles.
 */

/** Push to every device registered for a user id. */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<number> {
  const tokens = await notificationStore.listPushTokens({ userId });
  return sendPushToTokens(tokens.map((t) => t.token), message);
}

/** Push to every device registered under an agency. */
export async function sendPushToAgency(agency: string, message: PushMessage): Promise<number> {
  const tokens = await notificationStore.listPushTokens({ agency });
  return sendPushToTokens(tokens.map((t) => t.token), message);
}

/**
 * Deliver a PIN-reset OTP to the user's own registered devices. Falls back to
 * the server log so the flow remains operable before push registration —
 * never delivered to a caller-supplied address.
 */
export async function deliverOtp(userId: string, badgeNumber: string, code: string): Promise<"push" | "log"> {
  const delivered = await sendPushToUser(userId, {
    title: "Your PIN reset code",
    body: `Use code ${code} to reset your PIN. It expires in 10 minutes.`,
    data: { type: "otp" },
  });
  if (delivered > 0) return "push";
  logger.info({ badgeNumber }, "OTP issued (no push tokens registered — see demo response/logs)");
  return "log";
}

/**
 * Mirror an in-app notification as an Expo push to the matching devices.
 * Citizen-audience notifications are skipped (citizens are anonymous; their
 * devices have no registered token bound to the report).
 */
export async function dispatchPushForNotification(record: NotificationRecord): Promise<void> {
  const message: PushMessage = {
    title: record.title,
    body: record.message,
    data: {
      type: record.type,
      route: record.route,
      reportReference: record.reportReference,
    },
  };
  try {
    if (record.audience === "user" && record.userId) {
      await sendPushToUser(record.userId, message);
    } else if (record.audience === "agency" || record.audience === "admin") {
      const target = record.agency ?? (record.audience === "admin" ? "admin" : undefined);
      if (target) await sendPushToAgency(target, message);
    }
  } catch (err) {
    logger.warn({ err, type: record.type }, "Push dispatch failed");
  }
}
