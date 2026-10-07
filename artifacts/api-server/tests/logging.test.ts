import { afterEach, describe, expect, it, vi } from "vitest";
import pino from "pino";
import { Writable } from "node:stream";
import { loggerOptions } from "../src/lib/logger";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({ write(chunk, _e, cb) { lines.push(chunk.toString()); cb(); } });
  return { log: pino({ ...loggerOptions, level: "info" }, stream), lines };
}

describe("log redaction (no secrets or personal data leave the process)", () => {
  it("censors credentials, codes, tokens and contact details at any depth", () => {
    const { log, lines } = capture();
    log.info({
      pin: "1234",
      body: { code: "123456", phone: "+2348031234521", email: "officer@frsc.gov.ng", challengeToken: "abc.def" },
      user: { token: "bearer-xyz", secret: "JBSWY3DPEHPK3PXP" },
      reference: "CIR-FRS-2026-ABC123",
    }, "probe");
    const out = lines.join("");
    for (const leaked of ["1234\"", "123456", "+2348031234521", "officer@frsc.gov.ng", "abc.def", "bearer-xyz", "JBSWY3DPEHPK3PXP"]) {
      expect(out).not.toContain(leaked);
    }
    expect(out).toContain("[REDACTED]");
    expect(out).toContain("CIR-FRS-2026-ABC123"); // non-sensitive fields still logged
    expect(out).toContain('"service":"nsa-api"');
  });
});

describe("Better Stack log shipping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("batches lines and POSTs them with the source token", async () => {
    vi.stubEnv("BETTER_STACK_SOURCE_TOKEN", "src-token-test");
    vi.stubEnv("BETTER_STACK_INGEST_HOST", "s123.eu-nbg-2.betterstackdata.com");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("", { status: 202 });
    }));
    vi.useFakeTimers();
    const { createBetterStackStream } = await import("../src/lib/betterStack");
    const stream = createBetterStackStream();
    stream.write(JSON.stringify({ msg: "one" }) + "\n");
    stream.write(JSON.stringify({ msg: "two" }) + "\n");
    await vi.advanceTimersByTimeAsync(1100);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://s123.eu-nbg-2.betterstackdata.com");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer src-token-test");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual([{ msg: "one" }, { msg: "two" }]);
  });
});
