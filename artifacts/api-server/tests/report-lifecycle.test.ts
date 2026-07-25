import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, loginAs, submitReport } from "./helpers";

describe("citizen report lifecycle", () => {
  it("submits, tracks, updates status, reassigns, and appends timeline", async () => {
    const { reference } = await submitReport();
    expect(reference).toMatch(/^CIR-/);

    // Public tracking by reference.
    const tracked = await request(app).get(`/api/citizen-reports/track/${reference}`);
    expect(tracked.status).toBe(200);
    expect(tracked.body.report.status).toBe("submitted");
    expect(tracked.body.currentAgency).toBe("frsc");

    // Owning-agency officer updates the status.
    const officer = await loginAs("FO-001");
    const statusRes = await request(app)
      .patch(`/api/reports/${reference}/status`)
      .set("Authorization", `Bearer ${officer}`)
      .send({ reference, status: "triaged", actorName: "Okafor Emmanuel" });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.report.status).toBe("triaged");

    // A different agency cannot touch it.
    const police = await loginAs("NPF-001");
    const denied = await request(app)
      .patch(`/api/reports/${reference}/status`)
      .set("Authorization", `Bearer ${police}`)
      .send({ reference, status: "in_progress", actorName: "Insp. Okonkwo" });
    expect(denied.status).toBe(403);

    // Only admins reassign.
    const deniedReassign = await request(app)
      .post(`/api/reports/${reference}/reassign`)
      .set("Authorization", `Bearer ${officer}`)
      .send({ reference, agency: "police", actorName: "Okafor Emmanuel" });
    expect(deniedReassign.status).toBe(403);

    const admin = await loginAs("ADMIN-001");
    const reassigned = await request(app)
      .post(`/api/reports/${reference}/reassign`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ reference, agency: "police", actorName: "Admin Miriam Bello" });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.report.suggestedAgency).toBe("police");

    // After reassignment the police can append to the timeline; frsc cannot.
    const appended = await request(app)
      .post(`/api/reports/${reference}/timeline`)
      .set("Authorization", `Bearer ${police}`)
      .send({ reference, action: "Patrol dispatched", actorName: "Insp. Okonkwo" });
    expect(appended.status).toBe(200);

    const frscDenied = await request(app)
      .post(`/api/reports/${reference}/timeline`)
      .set("Authorization", `Bearer ${officer}`)
      .send({ reference, action: "Should fail", actorName: "Okafor Emmanuel" });
    expect(frscDenied.status).toBe(403);

    // Citizen tracking reflects the changes.
    const finalTrack = await request(app).get(`/api/citizen-reports/track/${reference}`);
    expect(finalTrack.body.currentAgency).toBe("police");
  });

  it("dedupes resubmissions carrying the same clientId", async () => {
    const clientId = `test-idempotency-${Math.random().toString(36).slice(2, 10)}`;
    const first = await submitReport({ clientId });
    const second = await submitReport({ clientId });
    expect(second.reference).toBe(first.reference);
    expect(second.report.id).toBe(first.report.id);

    const different = await submitReport({ clientId: `${clientId}-b` });
    expect(different.reference).not.toBe(first.reference);
  });

  it("validates submissions", async () => {
    const res = await request(app)
      .post("/api/citizen-reports")
      .send({ incidentType: "not_a_real_type", description: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });
});

describe("evidence", () => {
  it("creates metadata, uploads a binary, and serves signed downloads", async () => {
    // Submit with a clientId — the submitter's proof for the evidence attach.
    const clientId = "test-client-lifecycle-1";
    const { report, reference } = await submitReport({ clientId });

    const meta = await request(app)
      .post(`/api/reports/${reference}/evidence`)
      .send({ kind: "photo", uri: "file:///phone/crash.jpg", fileName: "crash.jpg", clientId });
    expect(meta.status).toBe(201);
    const evidenceId = meta.body.id as string;
    expect(meta.body.reportId).toBe(report.id);

    // Reject unsupported content types.
    const badUpload = await request(app)
      .put(`/api/reports/${reference}/evidence/${evidenceId}/content`)
      .set("Content-Type", "application/x-msdownload")
      .set("x-report-client-id", clientId)
      .send(Buffer.from("MZ..."));
    expect(badUpload.status).toBe(415);

    const upload = await request(app)
      .put(`/api/reports/${reference}/evidence/${evidenceId}/content`)
      .set("Content-Type", "image/jpeg")
      .set("x-report-client-id", clientId)
      .send(Buffer.from("FAKEJPEG-TEST-BYTES"));
    expect(upload.status).toBe(200);
    expect(upload.body.sizeBytes).toBe(19);
    expect(upload.body.checksum).toMatch(/^[0-9a-f]{64}$/);

    // Listing requires agency access.
    const anon = await request(app).get(`/api/reports/${reference}/evidence`);
    expect(anon.status).toBe(401);

    const officer = await loginAs("FO-001");
    const list = await request(app)
      .get(`/api/reports/${reference}/evidence`)
      .set("Authorization", `Bearer ${officer}`);
    expect(list.status).toBe(200);
    expect(list.body.evidence).toHaveLength(1);

    // Signed download link works and rejects tampering.
    const dl = await request(app)
      .get(`/api/reports/${reference}/evidence/${evidenceId}/download-url`)
      .set("Authorization", `Bearer ${officer}`);
    expect(dl.status).toBe(200);
    const download = await request(app).get(`/api${dl.body.path}`);
    expect(download.status).toBe(200);
    expect(download.body.toString()).toBe("FAKEJPEG-TEST-BYTES");

    const tampered = await request(app).get(`/api${dl.body.path.slice(0, -4)}XXXX`);
    expect(tampered.status).toBe(403);
  });
});
