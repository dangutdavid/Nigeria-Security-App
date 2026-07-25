import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers";

/**
 * With the server as the login authority, every demo account the mobile app
 * advertises on its login screens must authenticate server-side — otherwise
 * the login screen lies (regression: CMD-007/SV-042 were app-local only and
 * 401'd once the server verdict became binding).
 */
const ROSTER: Array<[badge: string, pin: string, agency: string, role: string]> = [
  ["FO-001", "1234", "frsc", "officer"],
  ["SV-042", "1234", "frsc", "supervisor"],
  ["CMD-007", "1234", "frsc", "commander"],
  ["FO-022", "5678", "frsc", "officer"],
  ["FO-037", "5678", "frsc", "officer"],
  ["NPF-001", "1234", "police", "officer"],
  ["NPF-042", "1234", "police", "supervisor"],
  ["NPF-CMD", "1234", "police", "commander"],
  ["VIO-001", "1234", "vio", "officer"],
  ["VIO-SV2", "1234", "vio", "supervisor"],
  ["VIO-CMD", "1234", "vio", "commander"],
  ["NSCDC-001", "1234", "civil_defence", "officer"],
  ["NSCDC-SV", "1234", "civil_defence", "supervisor"],
  ["NSCDC-CMD", "1234", "civil_defence", "commander"],
  ["ADMIN-001", "1234", "admin", "admin"],
  ["SUPER-001", "1234", "admin", "super_admin"],
];

describe("advertised demo roster authenticates server-side", () => {
  for (const [badge, pin, agency, role] of ROSTER) {
    it(`${badge} (${agency} ${role}) logs in`, async () => {
      const res = await request(app).post("/api/auth/login").send({ badgeNumber: badge, pin, agency });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe(role);
      expect(res.body.agency).toBe(agency);
    });
  }

  it("still rejects a wrong PIN for a roster account", async () => {
    const res = await request(app).post("/api/auth/login").send({ badgeNumber: "CMD-007", pin: "0000", agency: "frsc" });
    expect(res.status).toBe(401);
  });
});
