import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, verifyTotp } from "../src/lib/totp";

// RFC 6238 Appendix B — SHA-1 test vectors (8 digits, secret "12345678901234567890").
const SECRET = Buffer.from("12345678901234567890");
const VECTORS: Array<[number, string]> = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("TOTP (RFC 6238)", () => {
  for (const [t, expected] of VECTORS) {
    it(`matches the RFC vector at T=${t}`, () => {
      expect(hotp(SECRET, Math.floor(t / 30), 8)).toBe(expected);
    });
  }

  it("round-trips base32", () => {
    expect(base32Decode(base32Encode(SECRET)).equals(SECRET)).toBe(true);
  });

  it("accepts ±1 step of drift and rejects replays", () => {
    const b32 = base32Encode(SECRET);
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30000);
    const code = hotp(SECRET, step + 1);
    expect(verifyTotp(b32, code, { nowMs: now })).toBe(step + 1);
    expect(verifyTotp(b32, code, { nowMs: now, lastUsedStep: step + 1 })).toBeNull();
    expect(verifyTotp(b32, hotp(SECRET, step + 3), { nowMs: now })).toBeNull();
    expect(verifyTotp(b32, "12ab56", { nowMs: now })).toBeNull();
  });
});
