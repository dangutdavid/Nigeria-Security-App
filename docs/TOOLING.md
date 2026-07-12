# Tooling

This document lists the tools the workspace uses today, the tools added as part of the
architecture hardening pass, and the tools you should adopt before production. For the
system design itself see [ARCHITECTURE.md](ARCHITECTURE.md); for the ordered plan see
[ROADMAP.md](ROADMAP.md).

## In use today

| Tool | Where | Purpose |
| --- | --- | --- |
| pnpm workspaces | `pnpm-workspace.yaml` | Monorepo package management. `minimumReleaseAge: 1440` is a deliberate supply-chain defense — do not disable it. |
| TypeScript 5.9 (project references) | `tsconfig.base.json`, `pnpm run typecheck` | Whole-workspace type safety. Libs build with `tsc --build`; artifacts typecheck per package. |
| Express 5 + Zod | `artifacts/api-server` | HTTP API with runtime validation at every boundary. |
| Drizzle ORM + drizzle-kit | `lib/db` | Postgres schema, forward-only SQL migrations (`lib/db/migrations`). |
| Orval | `lib/api-spec/orval.config.ts` | Codegen from `openapi.yaml` → react-query client (`lib/api-client-react`) and Zod validators (`lib/api-zod`). The OpenAPI spec is the single source of truth for the API contract. |
| esbuild | `artifacts/api-server/build.mjs` | Server bundle. |
| Vitest + supertest | `artifacts/api-server/tests`, `artifacts/mobile/tests` | API tests (auth, RBAC, lifecycle, evidence, rate limits) and mobile repository tests. Hermetic: no database needed. |
| Expo / EAS | `artifacts/mobile/eas.json` | Mobile builds; profiles pinned in July 2026 build-out. |
| pino / pino-http | api-server | Structured logs with request correlation ids (`X-Request-Id`). |
| Prettier | root `devDependencies` | Formatting. |

## Added in this pass

| Tool | Where | Purpose |
| --- | --- | --- |
| GitHub Actions CI | `.github/workflows/ci.yml` | On every push/PR: frozen-lockfile install, workspace typecheck, API server tests, mobile tests, diff hygiene — plus a second job that applies all Drizzle migrations against a fresh Postgres 16 so a broken migration can never merge. |

## Adopt before production (in priority order)

1. **ESLint (flat config) + `typescript-eslint` + `eslint-plugin-security`** — typecheck
   catches type errors, not logic smells (floating promises, unhandled rejections,
   insecure patterns). Wire into the CI `check` job.
   `pnpm add -D -w eslint typescript-eslint eslint-plugin-security`
2. **Dependency audit in CI** — `pnpm audit --prod --audit-level high` as a CI step, plus
   GitHub Dependabot/Renovate with a cooldown matching `minimumReleaseAge`.
3. **Secret scanning** — enable GitHub secret scanning + push protection on the repo;
   `gitleaks` in CI as a backstop. The app signs auth tokens and evidence URLs with
   `AUTH_SECRET`; a leaked secret is a full-authentication bypass.
4. **Load testing** — `k6` scripts against the public endpoints (`POST /api/citizen-reports`,
   `GET /api/citizen-reports/track/:reference`) since these are unauthenticated and will
   absorb the worst abuse. Gate releases on p95 latency and error-rate budgets.
5. **Error tracking + APM** — Sentry (Expo has first-class support; pair with the server
   SDK so one incident links mobile release ↔ API trace via the correlation id).
6. **OpenAPI drift check** — CI step that runs Orval codegen and fails on a dirty diff, so
   `openapi.yaml`, the Zod validators, and the generated client can never diverge.
7. **Database backups + PITR** — managed Postgres (Neon/RDS/Cloud SQL) with point-in-time
   recovery; test restores quarterly. Migrations are forward-only, so backups are the
   rollback story.
8. **Redis** — shared rate-limit counters and token-revocation cache once the API runs on
   more than one instance (both are per-process `Map`s today; see ARCHITECTURE.md §9).

## Everyday commands

```sh
nvm use 22                                     # pnpm needs Node 22+
pnpm install
pnpm run typecheck                             # whole workspace
pnpm --filter @workspace/api-server test       # API test suite
pnpm --filter @workspace/mobile test           # mobile test suite
pnpm --filter @workspace/api-spec codegen      # regenerate client + zod from openapi.yaml
pnpm --filter @workspace/db run generate       # new migration from schema change
pnpm --filter @workspace/db run migrate        # apply migrations
pnpm --filter @workspace/mobile run dev        # Expo dev server
pnpm --filter @workspace/api-server run dev    # API on :8081
```
