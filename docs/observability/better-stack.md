# Better Stack: real-time logs and uptime

Better Stack complements Sentry (errors) and Prometheus (`/api/metrics`):
**Logs** gives live tail, search and alerting over structured API logs;
**Uptime** pages on-call when the API is down or the process stops.

## Logs (real-time)

1. Better Stack → Logs → *Connect source* → platform **HTTP**.
2. Set on the API:

   | Variable | Value |
   | --- | --- |
   | `BETTER_STACK_SOURCE_TOKEN` | the source token |
   | `BETTER_STACK_INGEST_HOST` | the ingesting host shown on the source page |

The API then sends every log line to both stdout and Better Stack, batched each
second (`src/lib/betterStack.ts`). Shipping is best-effort and never blocks a
request; if Better Stack is unreachable, lines are dropped and still reach
stdout and container logs.

**Privacy.** Logs are redacted *before* they leave the process. PINs, one-time
codes, tokens, TOTP secrets, phone numbers, e-mail addresses and auth headers
are replaced with `[REDACTED]` at any depth (`src/lib/logger.ts`, covered by
`tests/logging.test.ts`). Better Stack is still a data processor, so list it in
the record of processing activities and sign its DPA (see
`docs/compliance/README.md`). Pick an EU or the nearest region, and set log
retention to match the retention policy.

Useful saved searches and alerts:

- `level:>=50` (error), alerting on more than 20 in 5 min.
- `msg:"Daily budget exhausted"`, the AI assistant cost guard tripped.
- `title:"Two-factor failed"` (audit events), possible MFA brute force.
- `msg:"CORS: blocked disallowed origin"`, a probe or misconfiguration.
- Correlate any line with Sentry and the mobile report through `req.id` (the `X-Request-Id` header).

## Uptime

Run once per environment:

```sh
BETTER_STACK_API_TOKEN=… API_PUBLIC_URL=https://api.example.gov.ng ENV_NAME=production \
  scripts/betterstack/provision.sh
```

This creates two things:

- **A keyword monitor** on `/api/healthz` that expects `"status":"ok"`. It
  checks every 30 s from four regions and warns 14 days before the TLS
  certificate expires.
- **A heartbeat** with a 60 s period and 120 s grace. Set the printed
  `BETTER_STACK_HEARTBEAT_URL` on the API. The process pings it every minute,
  so a hung or crashed process alerts even if the load balancer still answers.

Then configure on-call schedules and escalation in the dashboard, and add the
public status page if you want one.
