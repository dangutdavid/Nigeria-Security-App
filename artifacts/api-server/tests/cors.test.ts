import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

/**
 * CORS must gate browser origins in production while never blocking the native
 * apps (which send no Origin header). Each case loads a fresh app under stubbed
 * env so the allowlist is re-read at module load.
 */
describe("CORS allowlist", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function freshApp(env: Record<string, string>) {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const mod = await import("../src/app");
    return mod.default;
  }

  it("in production, allows a whitelisted browser origin", async () => {
    const app = await freshApp({
      NODE_ENV: "production",
      AUTH_SECRET: "test-production-secret-abcdef123456",
      CORS_ALLOWED_ORIGINS: "https://admin.example.gov.ng,https://app.example.gov.ng",
    });
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "https://admin.example.gov.ng");
    expect(res.headers["access-control-allow-origin"]).toBe("https://admin.example.gov.ng");
  });

  it("in production, blocks a non-whitelisted browser origin (no CORS header)", async () => {
    const app = await freshApp({
      NODE_ENV: "production",
      AUTH_SECRET: "test-production-secret-abcdef123456",
      CORS_ALLOWED_ORIGINS: "https://admin.example.gov.ng",
    });
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("always allows requests with no Origin header (native apps)", async () => {
    const app = await freshApp({
      NODE_ENV: "production",
      AUTH_SECRET: "test-production-secret-abcdef123456",
      CORS_ALLOWED_ORIGINS: "https://admin.example.gov.ng",
    });
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
  });
});
