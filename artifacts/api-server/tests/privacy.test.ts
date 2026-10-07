import { describe, expect, it } from "vitest";
import request from "supertest";
import { runAsSystem } from "@workspace/db";
import { app, loginAs, submitReport } from "./helpers";
import { runRetention } from "../src/jobs/retention";
import { ANONYMIZED_TEXT } from "../src/lib/citizenReportStore";

const uid = () => `privacy-test-${Math.random().toString(36).slice(2, 12)}`;

describe("citizen data-subject rights", () => {
  it("exports a report only with reference + the submitting device's clientId", async () => {
    const clientId = uid();
    const { reference } = await submitReport({ clientId, description: "Export me: white Corolla, plate ABC-123" });

    const ok = await request(app).post("/api/privacy/citizen-reports/export").send({ reference, clientId });
    expect(ok.status).toBe(200);
    expect(ok.body.report.reference).toBe(reference);
    expect(ok.body.report.description).toContain("Corolla");

    const wrongDevice = await request(app).post("/api/privacy/citizen-reports/export").send({ reference, clientId: uid() });
    expect(wrongDevice.status).toBe(404);
    const referenceOnly = await request(app).post("/api/privacy/citizen-reports/export").send({ reference });
    expect(referenceOnly.status).toBe(400);
  });

  it("records an erasure request for the DPO (202) instead of deleting law-enforcement data outright", async () => {
    const clientId = uid();
    const { reference } = await submitReport({ clientId });
    const res = await request(app).post("/api/privacy/citizen-reports/erasure-request").send({ reference, clientId, reason: "I submitted by mistake" });
    expect(res.status).toBe(202);
    expect(res.body.requestId).toBeTruthy();
    expect(res.body.respondWithinDays).toBe(30);
  });

  it("lets only an admin execute erasure, which removes personal data and evidence", async () => {
    const clientId = uid();
    const { reference } = await submitReport({ clientId, description: "Name: Ada Obi, phone 0803..." });
    const meta = await request(app).post(`/api/reports/${reference}/evidence`).send({ kind: "photo", uri: "file:///x.jpg", fileName: "x.jpg", clientId });
    expect(meta.status).toBe(201);

    const officer = await loginAs("FO-001");
    const denied = await request(app).post(`/api/admin/privacy/citizen-reports/${reference}/erase`).set("Authorization", `Bearer ${officer}`).send({ reason: "test" });
    expect(denied.status).toBe(403);

    const admin = await loginAs("ADMIN-001");
    const erased = await request(app).post(`/api/admin/privacy/citizen-reports/${reference}/erase`).set("Authorization", `Bearer ${admin}`).send({ reason: "erasure request #1" });
    expect(erased.status).toBe(200);
    expect(erased.body.evidenceDeleted).toBe(1);

    const tracked = await request(app).get(`/api/citizen-reports/track/${reference}`);
    expect(tracked.status).toBe(200);
    expect(JSON.stringify(tracked.body)).not.toContain("Ada Obi");
    const evidence = await request(app).get(`/api/reports/${reference}/evidence`).set("Authorization", `Bearer ${admin}`);
    expect(evidence.body.evidence).toHaveLength(0);
  });
});

describe("staff right of access", () => {
  it("exports the signed-in user's own account and activity", async () => {
    const token = await loginAs("VIO-001");
    const res = await request(app).get("/api/auth/me/data-export").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.account.badgeNumber).toBe("VIO-001");
    expect(Array.isArray(res.body.activity)).toBe(true);
    expect(res.body.twoStepVerification).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/pinHash|pin_hash/);
  });
});

describe("retention job", () => {
  it("anonymises closed reports once their retention period has elapsed, and only those", async () => {
    const closedRef = (await submitReport({ description: "Old closed case with personal details" })).reference;
    const openRef = (await submitReport({ description: "Still open case" })).reference;
    const officer = await loginAs("FO-001");
    const closed = await request(app).patch(`/api/reports/${closedRef}/status`).set("Authorization", `Bearer ${officer}`).send({ reference: closedRef, status: "closed", actorName: "x" });
    expect(closed.status).toBe(200);

    const eightYearsLater = new Date(Date.now() + 8 * 365 * 86_400_000);
    const result = await runAsSystem(() => runRetention(eightYearsLater));
    expect(result.reportsAnonymized).toBeGreaterThanOrEqual(1);

    const admin = await loginAs("ADMIN-001");
    const old = await request(app).get(`/api/reports/${closedRef}`).set("Authorization", `Bearer ${admin}`);
    const open = await request(app).get(`/api/reports/${openRef}`).set("Authorization", `Bearer ${admin}`);
    expect(JSON.stringify(old.body)).toContain(ANONYMIZED_TEXT);
    expect(JSON.stringify(open.body)).toContain("Still open case");
  });
});
