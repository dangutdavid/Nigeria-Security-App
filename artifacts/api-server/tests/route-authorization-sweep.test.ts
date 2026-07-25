import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, loginAs, submitReport } from "./helpers";

/**
 * Pentest-style authorization sweep (Phase 2 exit criterion, internal pass):
 * every protected route in the route table must deny an anonymous caller, and
 * privileged routes must deny a plain officer. This is breadth cover — the
 * per-feature tests (rbac, evidence-binding, auth) assert the fine-grained
 * rules; this sweep guarantees no route is accidentally mounted open.
 *
 * If you add a route, add it here (or to PUBLIC below if intentionally open).
 */

type Method = "get" | "post" | "put" | "patch" | "delete";
interface RouteCheck {
  method: Method;
  path: string;
  /** Statuses accepted for an anonymous request. Must NOT include 2xx. */
  anon: number[];
  body?: Record<string, unknown>;
}

// Every authenticated/privileged route reachable in dev mode.
const PROTECTED: RouteCheck[] = [
  // reports (agency workflows)
  { method: "get", path: "/api/reports", anon: [401] },
  { method: "get", path: "/api/agencies/frsc/reports", anon: [401] },
  { method: "get", path: "/api/agencies/frsc/dashboard", anon: [401] },
  { method: "get", path: "/api/reports/REF-DOES-NOT-EXIST", anon: [401, 404] },
  { method: "patch", path: "/api/reports/REF-X/status", anon: [400, 401], body: { reference: "REF-X", status: "triaged", actorName: "x" } },
  { method: "post", path: "/api/reports/REF-X/reassign", anon: [400, 401], body: { reference: "REF-X", agency: "police", actorName: "x" } },
  { method: "post", path: "/api/reports/REF-X/timeline", anon: [400, 401], body: { reference: "REF-X", action: "x", actorName: "x" } },
  // agency registry management
  { method: "post", path: "/api/agencies", anon: [401], body: { id: "zz", shortName: "ZZ", fullName: "Test Agency" } },
  { method: "patch", path: "/api/agencies/frsc", anon: [401], body: { fullName: "Renamed" } },
  // audit (admin only)
  { method: "get", path: "/api/audit-logs", anon: [401] },
  { method: "get", path: "/api/audit-logs/export", anon: [401] },
  // notifications
  { method: "get", path: "/api/notifications", anon: [401] },
  { method: "patch", path: "/api/notifications/read-all", anon: [401] },
  { method: "patch", path: "/api/notifications/some-id/read", anon: [401] },
  { method: "post", path: "/api/push-tokens", anon: [400, 401], body: { token: "ExponentPushToken[xxxxxxxx]" } },
  // admin user management
  { method: "get", path: "/api/admin/users", anon: [401] },
  { method: "post", path: "/api/admin/users", anon: [401], body: { badgeNumber: "ZZ-1", displayName: "x", agency: "frsc", role: "officer", pin: "9999" } },
  { method: "patch", path: "/api/admin/users/some-id", anon: [401], body: { displayName: "y" } },
  { method: "delete", path: "/api/admin/users/some-id", anon: [401] },
  { method: "post", path: "/api/admin/users/some-id/reset-pin", anon: [400, 401], body: { newPin: "9999" } },
  // auth/session
  { method: "get", path: "/api/auth/me", anon: [401] },
  { method: "post", path: "/api/auth/refresh", anon: [401] },
  // operational model
  { method: "get", path: "/api/agency-units?agency=frsc", anon: [401] },
  { method: "post", path: "/api/agency-units", anon: [400, 401], body: { agency: "frsc", name: "Unit 1" } },
  { method: "get", path: "/api/case-types?agency=frsc", anon: [401] },
  { method: "post", path: "/api/case-types", anon: [400, 401], body: { agency: "frsc", name: "Type 1" } },
  { method: "get", path: "/api/duty-sessions", anon: [401] },
  { method: "post", path: "/api/duty-sessions/start", anon: [400, 401] },
  { method: "patch", path: "/api/duty-sessions/some-id/end", anon: [400, 401] },
  { method: "get", path: "/api/referrals", anon: [401, 404, 503] },
  { method: "post", path: "/api/referrals", anon: [400, 401, 404, 503], body: { reason: "x" } },
  { method: "patch", path: "/api/referrals/some-id/status", anon: [400, 401, 404, 503], body: { status: "acknowledged" } },
];

// Intentionally public surface (citizen features) — must NOT be 401/403.
const PUBLIC: RouteCheck[] = [
  { method: "get", path: "/api/healthz", anon: [200, 503] },
  { method: "get", path: "/api/agencies", anon: [200] },
  { method: "get", path: "/api/citizen-reports/track/CIR-DOES-NOT-EXIST", anon: [404] },
];

describe("route authorization sweep", () => {
  for (const route of PROTECTED) {
    it(`${route.method.toUpperCase()} ${route.path} denies anonymous callers`, async () => {
      const res = await request(app)[route.method](route.path).send(route.body ?? {});
      expect(route.anon).toContain(res.status);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  }

  for (const route of PUBLIC) {
    it(`${route.method.toUpperCase()} ${route.path} stays public (citizen surface)`, async () => {
      const res = await request(app)[route.method](route.path).send(route.body ?? {});
      expect(route.anon).toContain(res.status);
      expect([401, 403]).not.toContain(res.status);
    });
  }

  it("a plain officer cannot use admin-only surfaces", async () => {
    const officer = await loginAs("FO-001");
    const adminOnly: Array<[Method, string, Record<string, unknown> | undefined]> = [
      ["get", "/api/admin/users", undefined],
      ["get", "/api/audit-logs", undefined],
      ["post", "/api/agencies", { id: "zz", shortName: "ZZ", fullName: "Test Agency" }],
    ];
    for (const [method, path, body] of adminOnly) {
      const res = await request(app)[method](path).set("Authorization", `Bearer ${officer}`).send(body ?? {});
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
    }
  });

  it("an officer of one agency cannot read another agency's queue", async () => {
    await submitReport(); // ensure at least one frsc report exists
    const police = await loginAs("NPF-001");
    const res = await request(app)
      .get("/api/agencies/frsc/reports")
      .set("Authorization", `Bearer ${police}`);
    expect(res.status).toBe(403);
  });
});
