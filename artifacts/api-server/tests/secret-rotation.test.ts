import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 2.6 (roadmap E6): AUTH_SECRET can rotate without a logout storm.
 * Tokens signed under the old secret keep verifying while
 * AUTH_SECRET_PREVIOUS holds it; new tokens are minted with the new secret
 * only; dropping the previous secret ends the window.
 */
describe("AUTH_SECRET rotation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const OLD_SECRET = "old-secret-0123456789abcdef";
  const NEW_SECRET = "new-secret-0123456789abcdef";

  async function authModule(env: Record<string, string>) {
    vi.resetModules();
    vi.stubEnv("AUTH_SECRET_PREVIOUS", ""); // Clear between loads.
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return import("../src/lib/auth");
  }

  const user = {
    id: "u-1",
    name: "Test User",
    badgeNumber: "FO-001",
    agency: "frsc",
    role: "officer" as const,
  };

  it("a token signed under the old secret verifies during the rotation window", async () => {
    const oldAuth = await authModule({ AUTH_SECRET: OLD_SECRET });
    const oldToken = oldAuth.signToken(user);

    const rotated = await authModule({ AUTH_SECRET: NEW_SECRET, AUTH_SECRET_PREVIOUS: OLD_SECRET });
    const claims = rotated.verifyToken(oldToken);
    expect(claims?.badgeNumber).toBe("FO-001");
  });

  it("the same old token is rejected once the previous secret is dropped", async () => {
    const oldAuth = await authModule({ AUTH_SECRET: OLD_SECRET });
    const oldToken = oldAuth.signToken(user);

    const finished = await authModule({ AUTH_SECRET: NEW_SECRET });
    expect(finished.verifyToken(oldToken)).toBeNull();
  });

  it("new tokens are minted with the new secret (verify without the previous)", async () => {
    const rotated = await authModule({ AUTH_SECRET: NEW_SECRET, AUTH_SECRET_PREVIOUS: OLD_SECRET });
    const newToken = rotated.signToken(user);

    const finished = await authModule({ AUTH_SECRET: NEW_SECRET });
    expect(finished.verifyToken(newToken)?.badgeNumber).toBe("FO-001");
  });

  it("signed payloads (evidence URLs) also honour the rotation window", async () => {
    const oldAuth = await authModule({ AUTH_SECRET: OLD_SECRET });
    const signature = oldAuth.signPayload("evidence:abc:123");

    const rotated = await authModule({ AUTH_SECRET: NEW_SECRET, AUTH_SECRET_PREVIOUS: OLD_SECRET });
    expect(rotated.verifyPayloadSignature("evidence:abc:123", signature)).toBe(true);

    const finished = await authModule({ AUTH_SECRET: NEW_SECRET });
    expect(finished.verifyPayloadSignature("evidence:abc:123", signature)).toBe(false);
  });
});
