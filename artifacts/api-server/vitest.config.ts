import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Tests run against the in-memory stores and demo auth repository — no
    // database required, hermetic by design.
    env: {
      DATABASE_URL: "",
      // Hermetic: never let a developer's exported REDIS_URL leak shared
      // rate-limit counters or revocation state into tests.
      REDIS_URL: "",
      NODE_ENV: "test",
      AUTH_SECRET: "test-secret-not-for-production",
      EVIDENCE_STORAGE_DIR: "./.vitest-evidence",
      LOG_LEVEL: "silent",
    },
  },
});
