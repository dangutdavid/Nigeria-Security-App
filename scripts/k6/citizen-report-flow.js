import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

/**
 * k6 load script for the public citizen surface (roadmap Phase 3.4):
 *   1. POST /api/citizen-reports with a unique clientId
 *   2. GET  /api/citizen-reports/track/:reference
 *   3. POST /api/reports/:ref/evidence (metadata, bound by clientId)
 *
 * These endpoints are unauthenticated and will absorb the worst abuse, so
 * their single-instance ceiling sizes production autoscaling.
 *
 * Run:  k6 run scripts/k6/citizen-report-flow.js
 *       k6 run -e BASE_URL=http://localhost:8082 scripts/k6/citizen-report-flow.js
 * Stages model a burst ramp; tune to the deployment under test.
 *
 * NOTE: the submit endpoint rate-limits per IP. For a true ceiling test, run
 * distributed k6 (k6 cloud / multiple source IPs) or temporarily raise the
 * limiter in the environment under test — never in production config.
 */
const BASE_URL = __ENV.BASE_URL || "http://localhost:8081";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    // Release gates: tighten as the deployment proves itself.
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    submit_duration: ["p(95)<750"],
  },
};

const submitDuration = new Trend("submit_duration");

export default function main() {
  const clientId = `k6-${__VU}-${__ITER}-${Date.now()}`;

  const submit = http.post(
    `${BASE_URL}/api/citizen-reports`,
    JSON.stringify({
      clientId,
      incidentType: "road_crash",
      description: "k6 load test report — synthetic traffic",
      location: "Load Test Junction, Jos",
      emergencyLevel: "low",
      suggestedAgency: "frsc",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  submitDuration.add(submit.timings.duration);

  const submitted = check(submit, {
    "submit 201": (r) => r.status === 201,
    "submit has reference": (r) => Boolean(r.json("reference")),
  });
  // Rate-limited (429) is an expected outcome at the ceiling — do not continue the flow.
  if (!submitted) {
    sleep(1);
    return;
  }

  const reference = submit.json("reference");

  const track = http.get(`${BASE_URL}/api/citizen-reports/track/${reference}`);
  check(track, {
    "track 200": (r) => r.status === 200,
  });

  const evidence = http.post(
    `${BASE_URL}/api/reports/${reference}/evidence`,
    JSON.stringify({ kind: "photo", uri: "file:///k6/synthetic.jpg", clientId }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(evidence, {
    "evidence 201 or rate-limited": (r) => r.status === 201 || r.status === 429,
  });

  sleep(1);
}
