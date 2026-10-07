import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { runAsSystem } from "@workspace/db";
import { app } from "./helpers";
import { base32Decode, currentStep, hotp } from "../src/lib/totp";
import { mfaStore } from "../src/lib/mfaStore";

/**
 * Two-factor authentication end to end. Uses accounts no other test file logs
 * into (FO-022 / FO-037 / NSCDC-SV) and wipes their enrolment afterwards, so
 * the database-mode run (one shared DB) stays order-independent.
 */
const USERS = { totp: ["FO-022", "5678"], sms: ["FO-037", "5678"] } as const;

async function login(badge: string, pin: string, server = app) {
  return request(server).post("/api/auth/login").send({ badgeNumber: badge, pin });
}

function codeFor(secret: string, offset = 0) {
  return hotp(base32Decode(secret), currentStep() + offset);
}

const touched = new Set<string>();
afterAll(async () => {
  for (const id of touched) await runAsSystem(() => mfaStore.clear(id));
});

describe("authenticator app (TOTP)", () => {
  it("enrols, then requires the code at the next login, with replay protection and recovery codes", async () => {
    const first = await login(...USERS.totp);
    expect(first.status).toBe(200);
    expect(first.body.mfaRequired).toBeUndefined();
    touched.add(first.body.user.id);
    const auth = { Authorization: `Bearer ${first.body.token}` };

    const setup = await request(app).post("/api/auth/mfa/totp/setup").set(auth);
    expect(setup.status).toBe(200);
    expect(setup.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    const secret = setup.body.secret as string;

    const wrong = await request(app).post("/api/auth/mfa/totp/confirm").set(auth).send({ code: "000000" });
    expect(wrong.status).toBe(400);

    const confirm = await request(app).post("/api/auth/mfa/totp/confirm").set(auth).send({ code: codeFor(secret) });
    expect(confirm.status).toBe(200);
    expect(confirm.body.status.totpEnabled).toBe(true);
    const recoveryCodes = confirm.body.recoveryCodes as string[];
    expect(recoveryCodes).toHaveLength(10);

    // Next login: PIN alone no longer yields a session.
    const second = await login(...USERS.totp);
    expect(second.body.mfaRequired).toBe(true);
    expect(second.body.token).toBeUndefined();
    expect(second.body.methods).toEqual(expect.arrayContaining(["totp", "recovery"]));

    const bad = await request(app).post("/api/auth/mfa/verify").send({ challengeToken: second.body.challengeToken, method: "totp", code: "123456" });
    expect(bad.status).toBe(400);

    // The enrolment code's time step is spent; the next step is accepted.
    const nextCode = codeFor(secret, 1);
    const ok = await request(app).post("/api/auth/mfa/verify").send({ challengeToken: second.body.challengeToken, method: "totp", code: nextCode });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    // A challenge is single-use.
    const reuse = await request(app).post("/api/auth/mfa/verify").send({ challengeToken: second.body.challengeToken, method: "totp", code: nextCode });
    expect(reuse.status).toBe(400); // replayed TOTP step rejected first

    // Recovery code works once.
    const third = await login(...USERS.totp);
    const rec = await request(app).post("/api/auth/mfa/verify").send({ challengeToken: third.body.challengeToken, method: "recovery", code: recoveryCodes[0] });
    expect(rec.status).toBe(200);
    const fourth = await login(...USERS.totp);
    const recAgain = await request(app).post("/api/auth/mfa/verify").send({ challengeToken: fourth.body.challengeToken, method: "recovery", code: recoveryCodes[0] });
    expect(recAgain.status).toBe(400);
  });

  it("rejects a forged or tampered challenge", async () => {
    const res = await request(app).post("/api/auth/mfa/verify").send({ challengeToken: "eyJ0IjoibWZhIn0.forged-signature", method: "totp", code: "123456" });
    expect(res.status).toBe(401);
  });
});

describe("SMS one-time code", () => {
  it("enrols a phone and signs in with an SMS code (log provider exposes devCode outside production)", async () => {
    const first = await login(...USERS.sms);
    touched.add(first.body.user.id);
    const auth = { Authorization: `Bearer ${first.body.token}` };

    const bad = await request(app).post("/api/auth/mfa/sms/setup").set(auth).send({ phone: "12" });
    expect(bad.status).toBe(400);

    const setup = await request(app).post("/api/auth/mfa/sms/setup").set(auth).send({ phone: "08031234521" });
    expect(setup.status).toBe(200);
    expect(setup.body.maskedPhone).toMatch(/4521$/);
    expect(setup.body.maskedPhone).not.toContain("0803");
    const confirm = await request(app).post("/api/auth/mfa/sms/confirm").set(auth).send({ code: setup.body.devCode });
    expect(confirm.status).toBe(200);
    expect(confirm.body.status.smsEnabled).toBe(true);

    const second = await login(...USERS.sms);
    expect(second.body.methods).toContain("sms");
    const sent = await request(app).post("/api/auth/mfa/sms/send").send({ challengeToken: second.body.challengeToken });
    expect(sent.status).toBe(200);
    const ok = await request(app).post("/api/auth/mfa/verify").send({ challengeToken: second.body.challengeToken, method: "sms", code: sent.body.devCode });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
  });
});

describe("enforcement by role (MFA_ENFORCED_ROLES)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("a mandatory-MFA role gets an enrol-only session until a factor is set up", async () => {
    vi.resetModules();
    vi.stubEnv("MFA_ENFORCED_ROLES", "supervisor");
    const { default: enforcedApp } = await import("../src/app");

    const res = await login("NSCDC-SV", "1234", enforcedApp);
    expect(res.status).toBe(200);
    expect(res.body.mfaEnrollmentRequired).toBe(true);
    expect(res.body.capabilities).toEqual([]);
    touched.add(res.body.user.id);
    const auth = { Authorization: `Bearer ${res.body.token}` };

    const blocked = await request(enforcedApp).get("/api/reports").set(auth);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("mfa_enrollment_required");

    const setup = await request(enforcedApp).post("/api/auth/mfa/totp/setup").set(auth);
    expect(setup.status).toBe(200);
    const confirm = await request(enforcedApp).post("/api/auth/mfa/totp/confirm").set(auth).send({ code: codeFor(setup.body.secret) });
    expect(confirm.status).toBe(200);
    expect(confirm.body.token).toBeTruthy(); // upgraded to a full session

    const allowed = await request(enforcedApp).get("/api/agencies/civil_defence/reports").set({ Authorization: `Bearer ${confirm.body.token}` });
    expect(allowed.status).toBe(200);

    // The old restricted token was revoked on upgrade.
    const old = await request(enforcedApp).get("/api/auth/me").set(auth);
    expect(old.status).toBe(401);
  });
});
