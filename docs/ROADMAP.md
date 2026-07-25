# Roadmap — Working Backwards from Production

This plan starts from the end state and derives the exact steps to get there. The end
state is defined first; every phase below it exists only because the end state requires
it. Architecture details and diagrams are in [ARCHITECTURE.md](ARCHITECTURE.md); the
target topology is §9 there.

## The end state (what "done" means)

The app is live in the App Store and Play Store under `ng.gov.securityapp`. Millions of
citizens can submit and track reports without an account; tens of thousands of agency
users across FRSC, Police, VIO, NSCDC, and admin-created agencies work their queues
with push notifications. Concretely, production means:

- **E1. No trust in the client.** Every authorization decision is made server-side;
  the server's login verdict is the only login verdict; no demo credentials exist in
  production builds.
- **E2. No single-instance assumptions.** N stateless API instances behind a load
  balancer; rate limits and token revocation shared via Redis; evidence in S3/GCS;
  managed Postgres with PITR backups and read replicas.
- **E3. Abuse-resistant public surface.** WAF/CDN in front; every public endpoint
  rate-limited, validated, and idempotent; the assistant endpoint can't be used as a
  free AI proxy.
- **E4. Observable.** An on-call engineer can trace one citizen's failed report from
  the mobile release version to the API instance to the SQL statement via the
  correlation id, and alerts fire before users notice.
- **E5. Verified on real devices.** Push, offline sync, evidence upload, and login
  proven on physical iPhone and Android with production builds.
- **E6. Recoverable.** Backups restore-tested; secrets rotatable without logout
  storms; a bad migration can't reach production (CI applies every migration to a
  fresh database first).

Working backwards: E5 requires store builds (Phase 5), which require production
infrastructure to point at (Phase 4), which is only safe to expose once the security
gaps are closed (Phase 2) and observable (Phase 3), which is only trustworthy with CI
guarding every merge (Phase 1 — **done in this pass**). Read the phases top to bottom
as the execution order.

---

## Phase 1 — Engineering safety net ✅ (this pass)

> Enables everything: no phase below is safe to execute without CI catching
> regressions.

- [x] GitHub Actions CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)):
      frozen-lockfile install, workspace typecheck, API + mobile test suites, diff
      hygiene, and a migration job against fresh Postgres 16.
- [x] Add ESLint + `typescript-eslint` + `eslint-plugin-security` and wire into CI
      (flat config at `eslint.config.mjs`, scoped to the server/scripts/db).
- [x] Add the OpenAPI drift check: CI runs `pnpm --filter @workspace/api-spec codegen`
      and fails if `git status --porcelain lib/` is non-empty.
- [x] Secret scanning: gitleaks CI job + `.gitleaks.toml` (backstop).
      **Manual step remaining:** enable GitHub-native secret scanning + push
      protection in the repo's Settings → Code security (org/repo admin only).

## Phase 2 — Close the security gaps (blocks any public exposure)

> Derived from E1 and E3. Ordered by severity; items 1–3 are prerequisites for ever
> pointing a real domain at this API. Details in ARCHITECTURE.md §8.

**Status (July 2026): items 1–7 implemented on the `production-hardening`
branch, each with regression tests.** The remaining exit criterion is the
external pentest-style pass.

1. ✅ **Remove the legacy `mvp.ts` router from production**
   (`artifacts/api-server/src/routes/mvp.ts`). It trusts client-supplied
   `x-agency`/`x-user-role` headers and bypasses token auth entirely. Either delete it
   (preferred — the flat model has superseded it) or mount it only when
   `NODE_ENV !== "production"`. Add a test asserting `/api/tenants` 404s in
   production mode.
2. ✅ **Lock down the assistant endpoint**: add `requireAuth` or an aggressive per-IP
   rate limit (it proxies paid Anthropic/Gemini calls), plus a max-tokens/day budget
   guard.
3. ✅ **CORS allowlist**: replace open `cors()` with an explicit origin list
   (native apps send no Origin; the allowlist exists for the web/admin surface).
4. ✅ **Make the server the login authority**: in API mode, a server rejection must fail
   the mobile login (today `AuthContext` logs in locally and attaches the API session
   best-effort). Gate demo seeding behind a build flag that is off in production
   profiles.
5. ✅ **Bind evidence attach to the submitter**: require the report's `clientId` (or a
   one-time submission token returned at create) on
   `POST /reports/:ref/evidence` so strangers can't attach files to others' reports.
6. ✅ **Secret rotation**: support `AUTH_SECRET` + `AUTH_SECRET_PREVIOUS` verification so
   the secret can rotate without invalidating every session at once.
7. ✅ Run `pnpm audit --prod` clean; add it to CI (server tree clean of high/critical via overrides; Expo-toolchain-only advisories explicitly accepted).

**Exit criteria:** external pentest-style pass of every route in ARCHITECTURE.md's
route table finds no authorization bypass; all Phase 2 items have regression tests.

## Phase 3 — Observability and load proof

> Derived from E4. Do this before real infrastructure so the first deploy is already
> measurable.

1. 🟡 Sentry: `@sentry/node` wired in the API (activates with SENTRY_DSN; errors
   tagged with the `X-Request-Id` correlation id). **Mobile SDK
   (`@sentry/react-native`) still to add** — it needs the Expo config plugin and
   an EAS build, so it lands with Phase 5's first dev build.
2. ✅ Metrics endpoint: `GET /api/metrics` (Prometheus, Bearer `METRICS_TOKEN`):
   request rate/latency/error by route, rate-limit rejections by limiter, Node
   runtime metrics.
3. 🟡 Alerts: rules authored in
   [observability/alert-rules.yml](observability/alert-rules.yml) (healthz,
   error rate, p95, rate-limit spikes, assistant budget, event-loop lag).
   **Wiring them into a live Prometheus/Grafana needs the Phase 4 infra.**
4. 🟡 k6 script authored (`scripts/k6/citizen-report-flow.js`: submit → track →
   evidence, with p95/error thresholds). **The single-instance ceiling still
   needs an actual run** against a deployed instance.

**Exit criteria:** a induced failure (kill DB, saturate rate limit) pages with a trace
that names the failing route and instance.

## Phase 4 — Production infrastructure

> Derived from E2 and E6. Everything here slots into interfaces that already exist —
> no application rewrites.

1. **Managed Postgres** (RDS/Cloud SQL/Neon) with PITR; set `DATABASE_URL` via a
   secret manager; run `pnpm --filter @workspace/db run migrate` as a deploy step
   (CI already proves migrations apply cleanly).
2. ✅ **Redis**: shared backend implemented — set `REDIS_URL` and rate-limit
   counters become global (atomic Lua fixed-window) and token revocation gets a
   shared fast path (DB stays the durable record). Redis-down falls back to
   in-process, never a 500.
3. ✅ **S3/GCS evidence storage**: S3-compatible `EvidenceBinaryStorage`
   implemented (AWS S3 / R2 / MinIO via `EVIDENCE_S3_BUCKET`, `EVIDENCE_S3_REGION`
   or `EVIDENCE_S3_ENDPOINT`); the HMAC signed-URL scheme is kept — the bucket
   stays private.
4. 🟡 **Compute**: container built —
   `docker build -f artifacts/api-server/Dockerfile .` (node:22-alpine,
   non-root, container HEALTHCHECK on `/api/healthz`), production gates verified
   in-container. **Deploying ≥2 instances + LB + TLS + WAF is provider work.**
5. **Secrets**: AUTH_SECRET, DATABASE_URL, ANTHROPIC/GEMINI keys, EXPO_ACCESS_TOKEN
   in the platform secret manager; nothing in env files on disk.
6. **SMS/email OTP provider** (e.g. Termii/Twilio for Nigerian numbers) as the OTP
   fallback for users without a registered push device — plugs into `deliverOtp` in
   `src/lib/pushDispatch.ts`.
7. 🟡 Runbook documented ([RUNBOOK.md](RUNBOOK.md): rotation, backup/restore, Redis, triage, deploy checklist). **The actual restore test needs the managed database.**

**Exit criteria:** two API instances serve traffic simultaneously; killing one loses no
requests; a token revoked on instance A is rejected by instance B; k6 run from Phase 3
passes against the real stack at target load.

## Phase 5 — Mobile release

> Derived from E5. Requires accounts/devices (Apple Developer membership, Android
> keystore) — the one phase that cannot be done from this repo alone.

1. Apple Developer team + `eas credentials` for iOS signing and the Android keystore;
   confirm `ng.gov.securityapp` bundle id/package (already in `app.json`).
2. Point `production` profile env at the real API domain
   (`EXPO_PUBLIC_API_BASE_URL=https://api.<domain>/api` in `eas.json` — it currently
   holds a LAN IP for development).
3. `eas build --profile production` for both platforms; development-build QA pass on
   physical iPhone and Android: login, citizen report + track, evidence upload, push
   receipt + deep link, offline sync (airplane-mode test), agency reassignment flow.
4. Store listings, privacy policy (the app collects location + photos — both stores
   require disclosure), data-safety forms.
5. Staged rollout: TestFlight / Play internal track → closed pilot → production with
   phased rollout percentage.

**Exit criteria:** the ten flows in the README's test list pass on physical devices
against production infrastructure.

## Phase 6 — Pilot, then scale

> The end state says "millions"; you get there by proving one state/agency first.

1. Pilot with one agency command (e.g. one FRSC state command): seed real users via
   `/admin/users`, retire demo accounts, watch dashboards for a full duty cycle.
2. Tune from real numbers: rate-limit thresholds, autoscaling targets, push batch
   sizes, read-replica routing for `track/:reference` and dashboards.
3. Scale-out backlog (execute as load demands, not before):
   - Move push fan-out and CSV export to the job queue.
   - Read replicas for list/dashboard/track queries.
   - Converge the flat schema family into the tenant-scoped family (one data model,
     per ARCHITECTURE.md §5) once ops routes are the primary surface.
   - Partition `citizen_reports` by month if volume warrants (reference format
     already encodes year).
4. Quarterly: restore-test backups, rotate AUTH_SECRET (dual-secret window from
   Phase 2), re-run the k6 suite, dependency audit review.

---

## One-page checklist (execution order)

| # | Item | Phase | Status |
| --- | --- | --- | --- |
| 1 | CI: typecheck + tests + migration proof | 1 | ✅ done |
| 2 | ESLint + security lint in CI | 1 | ☐ |
| 3 | OpenAPI drift check in CI | 1 | ☐ |
| 4 | Remove/gate `mvp.ts` header-auth router | 2 | ☐ **highest priority** |
| 5 | Auth + rate limit on assistant endpoint | 2 | ☐ |
| 6 | CORS allowlist | 2 | ☐ |
| 7 | Server-authoritative mobile login; no demo seed in prod | 2 | ☐ |
| 8 | Evidence attach bound to submitter | 2 | ☐ |
| 9 | AUTH_SECRET rotation support | 2 | ☐ |
| 10 | Sentry both sides + metrics + alerts | 3 | ☐ |
| 11 | k6 load baseline | 3 | ☐ |
| 12 | Managed Postgres + PITR + deploy-time migrate | 4 | ☐ |
| 13 | Redis for rate limits + revocation | 4 | ☐ |
| 14 | S3/GCS `EvidenceBinaryStorage` | 4 | ☐ |
| 15 | Container + LB + WAF/TLS, ≥2 instances | 4 | ☐ |
| 16 | Secret manager for all secrets | 4 | ☐ |
| 17 | SMS/email OTP fallback provider | 4 | ☐ |
| 18 | Backup restore test + runbook | 4 | ☐ |
| 19 | iOS/Android credentials, prod API URL in eas.json | 5 | ☐ |
| 20 | Physical-device QA (10 README flows) | 5 | ☐ |
| 21 | Store listings + privacy disclosures + staged rollout | 5 | ☐ |
| 22 | Single-command pilot, then scale-out backlog | 6 | ☐ |
