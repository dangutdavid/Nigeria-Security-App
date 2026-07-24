import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, loginAs, submitReport } from "./helpers";

/**
 * Phase 2.5 (roadmap): evidence attach is bound to the report's submitter.
 * Unauthenticated attaches must present the report's clientId; strangers
 * cannot attach files to other people's reports.
 */
describe("evidence attach is bound to the submitter", () => {
  it("rejects an anonymous attach with no clientId", async () => {
    const { reference } = await submitReport({ clientId: "owner-client-id-123" });
    const res = await request(app)
      .post(`/api/reports/${reference}/evidence`)
      .send({ kind: "photo", uri: "file:///intruder.jpg" });
    expect(res.status).toBe(403);
  });

  it("rejects an anonymous attach with the wrong clientId", async () => {
    const { reference } = await submitReport({ clientId: "owner-client-id-456" });
    const res = await request(app)
      .post(`/api/reports/${reference}/evidence`)
      .send({ kind: "photo", uri: "file:///intruder.jpg", clientId: "stranger-client-id" });
    expect(res.status).toBe(403);
  });

  it("accepts the submitter's matching clientId for metadata and binary", async () => {
    const clientId = "owner-client-id-789";
    const { reference } = await submitReport({ clientId });

    const meta = await request(app)
      .post(`/api/reports/${reference}/evidence`)
      .send({ kind: "photo", uri: "file:///owner.jpg", clientId });
    expect(meta.status).toBe(201);

    const upload = await request(app)
      .put(`/api/reports/${reference}/evidence/${meta.body.id}/content`)
      .set("Content-Type", "image/jpeg")
      .set("x-report-client-id", clientId)
      .send(Buffer.from("OWNER-PHOTO-BYTES"));
    expect(upload.status).toBe(200);
  });

  it("rejects an anonymous binary upload without the clientId header", async () => {
    const clientId = "owner-client-id-abc";
    const { reference } = await submitReport({ clientId });
    const meta = await request(app)
      .post(`/api/reports/${reference}/evidence`)
      .send({ kind: "photo", uri: "file:///owner.jpg", clientId });
    expect(meta.status).toBe(201);

    const upload = await request(app)
      .put(`/api/reports/${reference}/evidence/${meta.body.id}/content`)
      .set("Content-Type", "image/jpeg")
      .send(Buffer.from("SNEAKY-BYTES"));
    expect(upload.status).toBe(403);
  });

  it("rejects anonymous attaches to reports submitted without a clientId", async () => {
    const { reference } = await submitReport();
    const res = await request(app)
      .post(`/api/reports/${reference}/evidence`)
      .send({ kind: "photo", uri: "file:///anon.jpg", clientId: "made-up-client-id" });
    expect(res.status).toBe(403);
  });

  it("lets an authenticated user attach without a clientId (officer working the case)", async () => {
    const { reference } = await submitReport({ clientId: "owner-client-id-def" });
    const token = await loginAs("FO-001");
    const res = await request(app)
      .post(`/api/reports/${reference}/evidence`)
      .set("Authorization", `Bearer ${token}`)
      .send({ kind: "statement", uri: "file:///officer-note.pdf" });
    expect(res.status).toBe(201);
  });
});
