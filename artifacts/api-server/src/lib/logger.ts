import pino, { type DestinationStream } from "pino";
import { betterStackConfigured, createBetterStackStream } from "./betterStack";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Logs never carry secrets or personal data (GDPR Art. 5(1)(c) minimisation,
 * NDPA s.24, HIPAA minimum-necessary): credentials, one-time codes, tokens,
 * phone numbers and e-mail addresses are censored wherever they appear in a
 * logged object, before any line leaves the process (stdout or Better Stack).
 */
const SENSITIVE_KEYS = [
  "pin", "newPin", "currentPin", "pinHash", "code", "devCode", "otp",
  "token", "challengeToken", "refreshToken", "secret", "totpSecretEnc", "otpauthUri",
  "phone", "smsPhoneEnc", "email", "password", "authorization", "cookie",
];

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-report-client-id']",
  "res.headers['set-cookie']",
  ...SENSITIVE_KEYS.flatMap((k) => [k, `*.${k}`, `*.*.${k}`]),
];

export const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: redactPaths, censor: "[REDACTED]" },
  base: {
    service: "nsa-api",
    env: process.env.NODE_ENV ?? "development",
    ...(process.env.SENTRY_RELEASE ? { release: process.env.SENTRY_RELEASE } : {}),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

function buildLogger(): pino.Logger {
  if (betterStackConfigured()) {
    // stdout (container logs) + Better Stack, both receiving redacted JSON.
    const streams: pino.StreamEntry[] = [
      { stream: process.stdout as DestinationStream },
      { stream: createBetterStackStream() as unknown as DestinationStream },
    ];
    return pino(loggerOptions, pino.multistream(streams));
  }
  if (!isProduction) {
    return pino({ ...loggerOptions, transport: { target: "pino-pretty", options: { colorize: true } } });
  }
  return pino(loggerOptions);
}

export const logger = buildLogger();
