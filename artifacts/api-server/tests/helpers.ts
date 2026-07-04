import request from "supertest";
import app from "../src/app";

export { app };

export async function loginAs(badgeNumber: string, pin = "1234", agency?: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ badgeNumber, pin, ...(agency ? { agency } : {}) });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${badgeNumber}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

export async function submitReport(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/citizen-reports")
    .send({
      incidentType: "road_crash",
      description: "Test crash report for automated tests",
      location: "Test Junction, Jos",
      emergencyLevel: "low",
      suggestedAgency: "frsc",
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`Report submission failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as { report: { id: string; reference: string }; reference: string };
}
