import { beforeAll } from "vitest";
import { initAuth } from "../../src/lib/auth";
import { initAgencies } from "../../src/lib/agencyStore";

// Database-mode only: mirror server startup (src/index.ts), which seeds the
// demo users and agency registry before accepting traffic. Idempotent.
beforeAll(async () => {
  await initAuth();
  await initAgencies();
});
