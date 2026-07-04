import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers";

// Isolated in its own file: vitest gives each file a fresh module graph, so
// exhausting the login limiter here cannot bleed into other test files.
describe("rate limiting", () => {
  it("returns 429 after too many login attempts", async () => {
    let saw429 = false;
    for (let i = 0; i < 25; i += 1) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ badgeNumber: "XX-999", pin: "0000" });
      if (res.status === 429) {
        saw429 = true;
        expect(res.headers["retry-after"]).toBeTruthy();
        break;
      }
      expect(res.status).toBe(401);
    }
    expect(saw429).toBe(true);
  });
});
