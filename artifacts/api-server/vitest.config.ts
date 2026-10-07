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
      // Test-only field-encryption key (32 bytes of ASCII, base64) — never a real key.
      DATA_ENCRYPTION_KEY: "dGVzdC1vbmx5LWZpZWxkLWVuY3J5cHRpb24ta2V5ISE=",
      EVIDENCE_STORAGE_DIR: "./.vitest-evidence",
      LOG_LEVEL: "silent",
    },
  },
});
