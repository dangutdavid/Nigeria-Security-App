import { logger } from "./logger";
import { maskPhone } from "./fieldCrypto";

/**
 * SMS delivery for second-factor codes.
 *
 *   SMS_PROVIDER=termii  — Nigerian operator routes (DND channel delivers OTPs
 *                          to numbers on the Do-Not-Disturb registry).
 *                          TERMII_API_KEY, TERMII_SENDER_ID
 *   SMS_PROVIDER=twilio  — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
 *   SMS_PROVIDER=log     — development only: nothing is sent.
 *
 * Message bodies are never logged (they contain the code).
 */
export type SmsProvider = "termii" | "twilio" | "log";

export function smsProvider(): SmsProvider {
  const value = (process.env.SMS_PROVIDER ?? "").toLowerCase();
  if (value === "termii" || value === "twilio") return value;
  if (process.env.NODE_ENV === "production" && value !== "log") {
    logger.error("SMS_PROVIDER is not configured — SMS second factor is unavailable.");
  }
  return "log";
}

export function smsConfigured(): boolean {
  return smsProvider() !== "log" || process.env.NODE_ENV !== "production";
}

export class SmsDeliveryError extends Error {}

export async function sendSms(to: string, body: string): Promise<void> {
  const provider = smsProvider();
  if (provider === "log") {
    if (process.env.NODE_ENV === "production") throw new SmsDeliveryError("SMS provider not configured.");
    logger.info({ to: maskPhone(to) }, "SMS (log provider — not sent)");
    return;
  }
  const res =
    provider === "termii"
      ? await fetch("https://api.ng.termii.com/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: process.env.TERMII_API_KEY,
            to: to.replace(/^\+/, ""),
            from: process.env.TERMII_SENDER_ID ?? "N-Alert",
            sms: body,
            type: "plain",
            channel: "dnd",
          }),
        })
      : await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM ?? "", Body: body }),
        });
  if (!res.ok) {
    logger.error({ provider, status: res.status, to: maskPhone(to) }, "SMS delivery failed");
    throw new SmsDeliveryError("SMS delivery failed.");
  }
}

/** E.164-ish validation: + and 8–15 digits. Nigerian local 0XXXXXXXXXX → +234. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.replace(/[\s()-]/g, "");
  const local = /^0(\d{10})$/.exec(trimmed);
  const candidate = local ? `+234${local[1]}` : trimmed;
  return /^\+\d{8,15}$/.test(candidate) ? candidate : null;
}
