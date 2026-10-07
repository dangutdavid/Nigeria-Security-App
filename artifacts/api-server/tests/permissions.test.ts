import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers";
import { capabilitiesFor, hasCapability, type Capability } from "../src/lib/permissions";

/**
 * Contract: what the server ENFORCES equals what the matrix says and what the
 * app is TOLD at login. If this fails, either a route guard or the matrix
 * drifted — fix the code, don't loosen the test.
 */
const ACCOUNTS = [
  ["FO-001", "officer"],
  ["SV-042", "supervisor"],
  ["CMD-007", "commander"],
  ["ADMIN-001", "admin"],
] as const;

const PROBES: Array<[Capability, "get", string]> = [
  ["report:view_all", "get", "/api/reports"],
  ["agency:dashboard", "get", "/api/agencies/frsc/dashboard"],
  ["report:view_agency", "get", "/api/agencies/frsc/reports"],
  ["user:manage", "get", "/api/admin/users"],
  ["audit:read", "get", "/api/audit-logs"],
];

describe("permission matrix is the single source of truth", () => {
  for (const [badge, role] of ACCOUNTS) {
    it(`${role}: login advertises exactly the enforced capabilities, and every probe agrees`, async () => {
      const login = await request(app).post("/api/auth/login").send({ badgeNumber: badge, pin: "1234" });
      expect(login.status).toBe(200);
      expect([...login.body.capabilities].sort()).toEqual([...capabilitiesFor(role)].sort());
      const auth = { Authorization: `Bearer ${login.body.token}` };

      for (const [capability, method, path] of PROBES) {
        const res = await request(app)[method](path).set(auth);
        const allowed = res.status < 400;
        expect(allowed, `${role} ${capability} ${path} -> ${res.status}`).toBe(hasCapability(role, capability));
      }
    });
  }

  it("agency scoping still applies on top of the capability", async () => {
    const login = await request(app).post("/api/auth/login").send({ badgeNumber: "FO-001", pin: "1234" });
    const res = await request(app).get("/api/agencies/police/dashboard").set({ Authorization: `Bearer ${login.body.token}` });
    expect(res.status).toBe(403);
  });
});
