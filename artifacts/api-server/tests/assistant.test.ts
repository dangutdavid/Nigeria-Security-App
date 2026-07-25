import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers";

/**
 * The assistant endpoint is public and proxies paid LLM calls, so it must be
 * rate limited even without authentication. With no provider key configured in
 * tests the handler returns 503 ("not configured"), but the per-IP limiter runs
 * first — so exceeding the window still yields 429 before the handler is hit.
 */
describe("assistant abuse controls", () => {
  const body = { messages: [{ role: "user", content: "How do I report a crash?" }] };

  it("rate-limits a single IP after the per-window maximum (default 15/10min)", async () => {
    let sawLimited = false;
    // One past the default max of 15 within the window.
    for (let i = 0; i < 16; i += 1) {
      const res = await request(app).post("/api/assistant/chat").send(body);
      if (res.status === 429) {
        sawLimited = true;
        expect(res.headers["retry-after"]).toBeTruthy();
        break;
      }
      // Before the limit, requests reach the handler and 503 (unconfigured in tests).
      expect([503, 400, 200]).toContain(res.status);
    }
    expect(sawLimited).toBe(true);
  });
});
