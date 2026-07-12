import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, loginAs } from "./helpers";

describe("auth", () => {
  it("logs in a demo user and returns a token with capabilities", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ badgeNumber: "FO-001", pin: "1234" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.badgeNumber).toBe("FO-001");
    expect(res.body.agency).toBe("frsc");
    expect(res.body.capabilities).toContain("report:view_agency");
  });

  it("rejects a wrong PIN", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ badgeNumber: "FO-001", pin: "0000" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  it("requires a token on /auth/me", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user on /auth/me with a valid token", async () => {
    const token = await loginAs("ADMIN-001");
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.badgeNumber).toBe("ADMIN-001");
    expect(res.body.role).toBe("admin");
  });

  it("rotates tokens on refresh and revokes the old one", async () => {
    const token = await loginAs("FO-001");
    const refresh = await request(app)
      .post("/api/auth/refresh")
      .set("Authorization", `Bearer ${token}`);
    expect(refresh.status).toBe(200);
    const newToken = refresh.body.token as string;
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(token);

    const oldMe = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(oldMe.status).toBe(401);

    const newMe = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${newToken}`);
    expect(newMe.status).toBe(200);
  });

  it("revokes the token on logout", async () => {
    const token = await loginAs("FO-001");
    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(logout.status).toBe(200);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(401);
  });

  it("refuses PIN reset without a verified OTP", async () => {
    const res = await request(app)
      .post("/api/auth/pin/reset")
      .send({ badgeNumber: "FO-001", newPin: "9876" });
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it("issues an OTP for a known badge and verifies it", async () => {
    const issued = await request(app)
      .post("/api/auth/otp/request")
      .send({ badgeNumber: "FO-001" });
    expect(issued.status).toBe(200);
    expect(issued.body.result).toBe("sent");
    // Non-production echoes the code for testability.
    expect(issued.body.code).toMatch(/^\d{6}$/);

    const wrong = await request(app)
      .post("/api/auth/otp/verify")
      .send({ badgeNumber: "FO-001", code: "000000" });
    expect(wrong.body.result).toBe("invalid");

    const right = await request(app)
      .post("/api/auth/otp/verify")
      .send({ badgeNumber: "FO-001", code: issued.body.code });
    expect(right.body.result).toBe("ok");
  });

  it("reports not_found for an unknown badge", async () => {
    const res = await request(app)
      .post("/api/auth/otp/request")
      .send({ badgeNumber: "NOPE-404" });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("not_found");
  });
});
