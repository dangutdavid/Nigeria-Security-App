import { main } from "./jobs/retention";
import { logger } from "./lib/logger";

// Entry point for the scheduled retention job: `node dist/retention.mjs`.
main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Retention run failed");
    process.exit(1);
  });
