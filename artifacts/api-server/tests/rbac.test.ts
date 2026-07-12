import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, loginAs, submitReport } from "./helpers";

describe("role-based access control", () => {
  it("requires auth for the global report list", async () => {
    const res = await request(app).get("/api/reports");
    expect(res.status).toBe(401);
  });

  it("allows admins to list all reports", async () => {
    await submitReport();
    const token = await loginAs("ADMIN-001");
    const res = await request(app).get("/api/reports").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reports)).toBe(true);
  });

  it("blocks an agency user from another agency's report list", async () => {
    const token = await loginAs("FO-001"); // frsc officer
    const res = await request(app)
      .get("/api/agencies/police/reports")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("allows an agency user to list their own agency's reports", async () => {
    await submitReport();
    const token = await loginAs("FO-001");
    const res = await request(app)
      .get("/api/agencies/frsc/reports")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("blocks non-admins from creating agencies", async () => {
    const token = await loginAs("FO-001");
    const res = await request(app)
      .post("/api/agencies")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Should Fail",
        shortName: "SF",
        fullName: "Should Fail Agency",
        primaryColor: "#123456",
        secondaryColor: "#654321",
        badgePrefix: "SF",
        description: "Not allowed",
      });
    expect(res.status).toBe(403);
  });

  it("allows admins to create and update agencies", async () => {
    const token = await loginAs("ADMIN-001");
    const created = await request(app)
      .post("/api/agencies")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Test Fire Service",
        shortName: "TFS",
        fullName: "Test Fire Service of Nigeria",
        primaryColor: "#AA3311",
        secondaryColor: "#CC5533",
        badgePrefix: "TFS",
        description: "Fire and rescue operations",
      });
    expect(created.status).toBe(201);
    expect(created.body.id).toBe("test_fire_service");

    const dup = await request(app)
      .post("/api/agencies")
      .set("Authorization", `Bearer ${token}`)
      .send({
        id: "test_fire_service",
        name: "Test Fire Service",
        shortName: "TFS",
        fullName: "Test Fire Service of Nigeria",
        primaryColor: "#AA3311",
        secondaryColor: "#CC5533",
        badgePrefix: "TFS",
        description: "Duplicate",
      });
    expect(dup.status).toBe(409);

    const updated = await request(app)
      .patch("/api/agencies/test_fire_service")
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body.isActive).toBe(false);
  });

  it("exposes the agency registry publicly for the login screen", async () => {
    const res = await request(app).get("/api/agencies");
    expect(res.status).toBe(200);
    const ids = res.body.agencies.map((a: { id: string }) => a.id);
    expect(ids).toContain("frsc");
    expect(ids).toContain("admin");
  });

  it("restricts audit logs to admins", async () => {
    const officer = await loginAs("FO-001");
    const denied = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${officer}`);
    expect(denied.status).toBe(403);

    const admin = await loginAs("ADMIN-001");
    const allowed = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${admin}`);
    expect(allowed.status).toBe(200);
    expect(Array.isArray(allowed.body.auditLogs)).toBe(true);

    const csv = await request(app)
      .get("/api/audit-logs/export")
      .set("Authorization", `Bearer ${admin}`);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text.split("\n")[0]).toContain("id,createdAt,type");
  });
});
