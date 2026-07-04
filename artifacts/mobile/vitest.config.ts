import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for the pure service layer only (repositories' API-first /
// local-fallback logic). React Native / Expo modules are mocked at the module
// boundary in the tests themselves.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
