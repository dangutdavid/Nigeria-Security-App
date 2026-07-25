import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

/**
 * The legacy MVP router trusts client-supplied identity headers and must never
 * be reachable in production. These tests load a fresh app instance under a
 * stubbed NODE_ENV so the mount decision in routes/index.ts is re-evaluated.
 */
describe("legacy mvp router gating", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function freshApp(nodeEnv: string) {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", nodeEnv);
    // auth.ts refuses to load in production without a real AUTH_SECRET.
    if (nodeEnv === "production") {
      vi.stubEnv("AUTH_SECRET", "test-production-secret-abcdef123456");
    }
    const mod = await import("../src/app");
    return mod.default;
  }

  it("serves /api/tenants outside production (dev/demo convenience)", async () => {
    const app = await freshApp("test");
    const res = await request(app).get("/api/tenants");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tenants)).toBe(true);
  });

  it("404s /api/tenants in production", async () => {
    const app = await freshApp("production");
    const res = await request(app).get("/api/tenants");
    expect(res.status).toBe(404);
  });

  it("does not honour x-agency/x-user-role header identity in production", async () => {
    const app = await freshApp("production");
    // The MVP router's /api/cases trusted these headers to synthesize an actor.
    const res = await request(app)
      .get("/api/cases")
      .set("x-agency", "police")
      .set("x-user-role", "commander");
    expect(res.status).toBe(404);
  });
});
