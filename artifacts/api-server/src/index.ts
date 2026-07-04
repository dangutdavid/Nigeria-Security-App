import app from "./app";
import { initAuth } from "./lib/auth";
import { initAgencies } from "./lib/agencyStore";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];
const fallbackPort = process.env["API_PORT"] ?? "8081";

const port = Number(rawPort ?? fallbackPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  // Seed demo auth users (DB mode) before accepting traffic; never blocks on a
  // missing/unreachable database.
  await initAuth();
  // Seed the built-in agency registry (DB mode) — idempotent, never throws.
  await initAgencies();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void start();
