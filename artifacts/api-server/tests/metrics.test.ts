import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "./helpers";

describe("metrics endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("serves Prometheus metrics including request counters", async () => {
    // Generate at least one observed request first.
    await request(app).get("/api/healthz");

    const res = await request(app).get("/api/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("http_requests_total");
    expect(res.text).toContain("http_request_duration_seconds");
    expect(res.text).toContain("nodejs_eventloop_lag_seconds");
  });

  it("requires the bearer token when METRICS_TOKEN is set", async () => {
    vi.stubEnv("METRICS_TOKEN", "scrape-secret");
    const denied = await request(app).get("/api/metrics");
    expect(denied.status).toBe(401);

    const allowed = await request(app)
      .get("/api/metrics")
      .set("Authorization", "Bearer scrape-secret");
    expect(allowed.status).toBe(200);
  });

  it("labels routes without exploding cardinality (params collapsed)", async () => {
    await request(app).get("/api/citizen-reports/track/NSA-2026-DOESNOTEXIST");
    const res = await request(app).get("/api/metrics");
    // The tracked reference must not appear verbatim as a route label.
    expect(res.text).not.toContain("NSA-2026-DOESNOTEXIST");
  });
});
