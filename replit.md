# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### FRSC Field Operations (Mobile — Expo)
A full-featured Nigeria Road Safety / FRSC field operations mobile app.

**Features (all screens fully built):**
- Role-based authentication (Field Officer, Supervisor, Commander) — PIN-based
- Home dashboard with metrics, duty banner, quick actions, "My Recent Reports" section, analytics shortcut
- Multi-step crash/incident reporting wizard (5 steps: type/severity, location+GPS, victims, vehicles, evidence+submit)
- Live incident map (react-native-maps) — severity + type filters, floating count, selected-incident card with direct navigation
- Case list with advanced filtering: status tabs, severity chips, "Mine" toggle, location filter (state + LGA multi-select with GPS detect), active filter strip
- Case detail with timeline, vehicle/victim records, notes, assignment modal, share/export (native Share sheet)
- Case assignment (supervisor/commander) — modal with officer list
- Alerts screen (role-aware: fatal open + unassigned for supervisors; dismissable cards)
- Tab bar alert badge (computed from fatal open incidents + unassigned count)
- Analytics & hotspots dashboard: incident type, severity grid, status breakdown, top LGAs by count, hotspot states ranking, operational insights
- Profile and settings (offline mode toggle, dark mode, auto-sync, manage users, vehicle lookup link)
- User management (list + create/edit form, role/status filtering)
- Vehicle lookup (plate search)
- Patrol/duty log (start/end duty, break, encounter logging, history, live elapsed timer)
- Change PIN (strength meter, current PIN verification)
- Offline-first with AsyncStorage persistence; pendingSync flag; SyncBanner

**Incident card shows:**
- State chip (blue) + LGA chip (muted) for each incident
- Severity-coloured icon, status badges, pending-sync cloud icon

**Demo accounts (PIN 1234):**
- `FO-001` — Field Officer (Okafor Emmanuel)
- `SV-042` — Supervisor (Adaeze Nwosu)
- `CMD-007` — Commander (Babatunde Adeyemi)
- `FO-022`, `FO-037` — PIN 5678

**Seed data storage key:** `@frsc_incidents_v2` (multi-state: Plateau, Kaduna, Kano, Rivers, Lagos, Nasarawa, FCT)

**Nigeria LGA data:** `artifacts/mobile/data/nigeriaLGAs.ts` — all 37 states + FCT with full LGA lists

**Location:** `artifacts/mobile/`

### API Server (Express + TypeScript)
Backend API server.
**Location:** `artifacts/api-server/`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## User preferences

- **Keep GitHub in sync**: regularly push the project to the GitHub repo
  `dangutdavid/Nigeria-Security-App` (branch `main`) to keep it updated. Push at the
  end of each task/turn after making changes. Use the Replit GitHub connector token
  (see `.agents/memory/github-push-via-connector.md` for the exact push method).
  Note: Replit's end-of-turn auto-checkpoint commits one step after the turn ends, so
  each push may lag by one checkpoint and catches up on the next push.
- **Keep progress in a living `.md` file**: maintain `README.md` (GitHub-facing project
  overview) and `PROGRESS.md` (MVP-audit checklist status + a dated build log) at the repo
  root. Update `PROGRESS.md` at the end of each working session — flip checklist items as they
  ship and add a build-log entry for what changed.
