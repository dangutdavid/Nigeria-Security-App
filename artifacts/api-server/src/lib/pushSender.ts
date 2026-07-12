import { logger } from "./logger";

/**
 * Expo push delivery. Sends registered Expo push tokens through Expo's push
 * API (https://docs.expo.dev/push-notifications/sending-notifications/).
 * No SDK needed — the HTTP API accepts batched JSON messages.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export interface PushMessage {
  title: string;
  body: string;
  /** Arbitrary payload delivered to the app's notification handler. */
  data?: Record<string, unknown>;
}

function isExpoToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

async function postToExpo(messages: Array<Record<string, unknown>>): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Expo push API responded ${response.status}: ${body.slice(0, 300)}`);
  }
  const result = (await response.json()) as { data?: Array<{ status: string; message?: string }> };
  const errors = result.data?.filter((r) => r.status !== "ok") ?? [];
  if (errors.length > 0) {
    logger.warn({ errors: errors.slice(0, 5) }, "Some push messages were rejected by Expo");
  }
}

/** Send a push message to a set of raw Expo tokens. Returns delivered count. */
export async function sendPushToTokens(tokens: string[], message: PushMessage): Promise<number> {
  const valid = [...new Set(tokens)].filter(isExpoToken);
  if (valid.length === 0) return 0;
  const messages = valid.map((to) => ({
    to,
    sound: "default",
    title: message.title,
    body: message.body,
    data: message.data ?? {},
  }));
  let delivered = 0;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      await postToExpo(batch);
      delivered += batch.length;
    } catch (err) {
      logger.warn({ err }, "Expo push batch failed");
    }
  }
  return delivered;
}

