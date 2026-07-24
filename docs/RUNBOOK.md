# Operations Runbook

Procedures for the situations that matter when they happen, not when you have
time to research them. Companion to [ARCHITECTURE.md](ARCHITECTURE.md) (system
design) and [ROADMAP.md](ROADMAP.md) (execution order).

## 1. Secret rotation without a logout storm (E6)

`AUTH_SECRET` signs login tokens and evidence download URLs. Rotating it
naively invalidates every live session at once. The server supports a
two-secret window instead:

1. Generate the new secret: `openssl rand -base64 32`
2. Deploy with **both**:
   ```
   AUTH_SECRET=<new secret>
   AUTH_SECRET_PREVIOUS=<old secret>
   ```
   New tokens are minted with the new secret; existing tokens (and signed
   evidence URLs) keep verifying against the old one.
3. After **12 hours** (one full token TTL — every old token has expired),
   remove `AUTH_SECRET_PREVIOUS` and redeploy.

If the secret was **compromised** (not routine rotation): skip the window.
Deploy the new secret alone — the logout storm is the point.

Regression tests: `artifacts/api-server/tests/secret-rotation.test.ts`.

## 2. Database backup and restore (E6)

Managed Postgres (Neon / RDS / Cloud SQL) with point-in-time recovery is the
baseline — migrations are forward-only, so **backups are the rollback story**.

- **Provisioning requirements:** PITR enabled; automated daily snapshots;
  retention ≥ 14 days; snapshots replicated to a second region if the provider
  supports it.
- **Restore test (quarterly, non-negotiable):**
  1. Restore the latest snapshot to a *fresh* instance.
  2. Point a staging API at it (`DATABASE_URL=...`), run
     `pnpm --filter @workspace/db run migrate` (must be a no-op or apply
     cleanly), and hit `/api/healthz` (expect `db: postgres`).
  3. Spot-check: one citizen report by reference, one agency login, one
     evidence signed-URL download.
  4. Record the wall-clock restore time — that number is your real RPO/RTO.
- **Bad migration reaches production:** do not write a "down" migration under
  pressure. Restore to the pre-migration point (PITR), replay the fix as a new
  forward migration, redeploy. CI already proves every migration applies to a
  fresh database before merge.

## 3. Evidence storage

- Local disk (`EVIDENCE_STORAGE_DIR`) is a single-instance dev/demo mode.
  Production sets `EVIDENCE_S3_BUCKET` (+ `EVIDENCE_S3_REGION`, or
  `EVIDENCE_S3_ENDPOINT` for R2/MinIO) — a private bucket; the API streams
  objects through its HMAC signed-URL scheme, so no public bucket ACLs exist.
- Bucket must have versioning ON (accidental-deletion recovery) and a
  lifecycle rule only for incomplete multipart uploads — evidence is never
  auto-expired.
- Migration from disk → S3: copy `data/evidence/**` to
  `s3://<bucket>/evidence/` preserving the `reportId/evidenceId` key layout;
  no database change is needed (storage keys are provider-agnostic).

## 4. Redis (shared rate limits + revocation)

- `REDIS_URL` activates shared rate-limit counters and the token-revocation
  fast path. **The API stays up if Redis goes down** — limiters fall back to
  per-instance windows and revocation falls through to Postgres. Alert on the
  fallback (log line: "Redis connection error") rather than paging.
- Redis restart wipes revocation keys: harmless — Postgres holds the durable
  revocation record and repopulates the check path.

## 5. Incident triage (E4)

Every response carries `X-Request-Id`.

1. Get the id from the client error report (mobile logs it on failure).
2. `grep` the API logs (or Sentry tag `request_id`) — pino logs carry the same
   id on every line of that request.
3. `/api/metrics` shows the route's error rate and latency histograms;
   `rate_limit_rejections_total` distinguishes abuse from failure.
4. Alert rules live in [observability/alert-rules.yml](observability/alert-rules.yml).

## 6. Deploy checklist (production)

- [ ] `NODE_ENV=production`
- [ ] `AUTH_SECRET` set (≥16 chars, from a secret manager — never a file in git)
- [ ] `DATABASE_URL` set; migrations applied as a deploy step
- [ ] `REDIS_URL` set when running >1 instance
- [ ] `EVIDENCE_S3_BUCKET` set (private bucket)
- [ ] `CORS_ALLOWED_ORIGINS` set to the exact web origins (or empty = native-only)
- [ ] `ALLOW_DEMO_USERS` **unset** (or `false`) — demo logins must 401
- [ ] `METRICS_TOKEN` set; scraper configured with it
- [ ] `SENTRY_DSN` set; release tagged (`SENTRY_RELEASE`)
- [ ] `ANTHROPIC_API_KEY`/`GEMINI_API_KEY` set server-side only
- [ ] Load balancer health check → `/api/healthz`
- [ ] k6 baseline re-run after any capacity-relevant change (`scripts/k6/`)

Smoke test after deploy:

```sh
curl -fsS https://<host>/api/healthz            # {"status":"ok","db":"postgres"}
curl -s -o /dev/null -w '%{http_code}' \
  -X POST https://<host>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"badgeNumber":"FO-001","pin":"1234"}'    # expect 401 (demo gated off)
curl -s -o /dev/null -w '%{http_code}' https://<host>/api/tenants   # expect 404 (mvp gated off)
```
