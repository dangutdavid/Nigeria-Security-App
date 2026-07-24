import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

/**
 * In production builds, demo credentials must not exist (roadmap E1): the
 * fixed-PIN seed users and the dynamic {PREFIX}-001/PIN-1234 backdoor are
 * disabled unless an operator explicitly opts in with ALLOW_DEMO_USERS=true.
 */
describe("demo credentials are gated out of production", () => {
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

  const prodEnv = { NODE_ENV: "production", AUTH_SECRET: "test-production-secret-abcdef123456" };

  it("rejects a documented demo login in production", async () => {
    const app = await freshApp(prodEnv);
    const res = await request(app).post("/api/auth/login").send({ badgeNumber: "FO-001", pin: "1234" });
    expect(res.status).toBe(401);
  });

  it("rejects the dynamic {PREFIX}-001/demo-PIN backdoor in production", async () => {
    const app = await freshApp(prodEnv);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ badgeNumber: "DSS-001", pin: "1234", agency: "dss" });
    expect(res.status).toBe(401);
  });

  it("allows demo login when an operator explicitly opts in", async () => {
    const app = await freshApp({ ...prodEnv, ALLOW_DEMO_USERS: "true" });
    const res = await request(app).post("/api/auth/login").send({ badgeNumber: "FO-001", pin: "1234" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("still allows demo login outside production (dev/test default)", async () => {
    const app = await freshApp({ NODE_ENV: "test" });
    const res = await request(app).post("/api/auth/login").send({ badgeNumber: "FO-001", pin: "1234" });
    expect(res.status).toBe(200);
  });
});
