import { defineConfig } from "vitest/config";

/**
 * Database-mode suite: the same API tests, run against a real Postgres so that
 * row-level security, grants and constraints are exercised (the default suite
 * is hermetic/in-memory and cannot see RLS). Requires TEST_DATABASE_URL — a
 * fresh, migrated database the app role can connect to.
 *
 *   TEST_DATABASE_URL=postgres://nsa_app:...@localhost:5432/nsa_test pnpm test:db
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is required for the database-mode suite.");

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Files share one database; run them serially so rate-limit and seeding
    // state can't race across workers.
    fileParallelism: false,
    globalSetup: ["./tests/setup/db-global.ts"],
    setupFiles: ["./tests/setup/db-seed.ts"],
    env: {
      DATABASE_URL: url,
      TEST_DATABASE_ADMIN_URL: process.env.TEST_DATABASE_ADMIN_URL ?? url,
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
