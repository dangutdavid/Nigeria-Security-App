import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "./helpers";

describe("per-account lockout (independent of source IP)", () => {
  it("locks a badge after 10 consecutive failures, even for the correct PIN", async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).post("/api/auth/login").send({ badgeNumber: "NPF-042", pin: "0000" });
      expect(res.status).toBe(401);
    }
    const locked = await request(app).post("/api/auth/login").send({ badgeNumber: "NPF-042", pin: "1234" });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe("account_locked");
    expect(locked.headers["retry-after"]).toBeTruthy();
  });

  it("locks unknown badges the same way (no account enumeration)", async () => {
    // Lower threshold so this test stays under the separate per-IP login limit.
    vi.stubEnv("LOCKOUT_THRESHOLD", "3");
    for (let i = 0; i < 3; i += 1) {
      await request(app).post("/api/auth/login").send({ badgeNumber: "NOPE-404", pin: "0000" });
    }
    const res = await request(app).post("/api/auth/login").send({ badgeNumber: "NOPE-404", pin: "0000" });
    expect(res.body.code).toBe("account_locked");
    vi.unstubAllEnvs();
  });
});
