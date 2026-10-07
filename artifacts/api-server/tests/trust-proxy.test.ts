import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

async function freshApp(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("../src/app")).default;
}

describe("TRUST_PROXY", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("behind one proxy hop, each client gets its own rate-limit bucket", async () => {
    const app = await freshApp({ TRUST_PROXY: "1", ASSISTANT_RATE_MAX: "2" });
    const hit = (ip: string) => request(app).post("/api/assistant/chat").set("X-Forwarded-For", ip).send({ messages: [{ role: "user", content: "hi" }] });
    await hit("203.0.113.1");
    await hit("203.0.113.1");
    expect((await hit("203.0.113.1")).status).toBe(429);
    expect((await hit("203.0.113.2")).status).not.toBe(429); // different citizen unaffected
  });

  it("unset: a forged X-Forwarded-For cannot dodge the limit", async () => {
    const app = await freshApp({ ASSISTANT_RATE_MAX: "2" });
    const hit = (ip: string) => request(app).post("/api/assistant/chat").set("X-Forwarded-For", ip).send({ messages: [{ role: "user", content: "hi" }] });
    await hit("198.51.100.1");
    await hit("198.51.100.2");
    expect((await hit("198.51.100.3")).status).toBe(429);
  });
});
