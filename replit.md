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

**Features:**
- Role-based authentication (Field Officer, Supervisor, Commander)
- Home dashboard with metrics and quick actions
- Multi-step crash/incident reporting wizard
- Live incident map (react-native-maps)
- Case list with search and filters (status + severity)
- Case detail with timeline, vehicle/victim records, and notes
- Alerts and notifications (role-aware)
- Analytics & hotspot dashboard
- Profile and settings (offline mode toggle, auto-sync)
- Offline-first with AsyncStorage persistence
- Seeded demo incidents for immediate use

**Demo accounts (PIN for all: 1234):**
- `FO-001` — Field Officer
- `SV-042` — Supervisor
- `CMD-007` — Commander

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
