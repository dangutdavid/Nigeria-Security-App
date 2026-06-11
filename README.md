# Nigeria Safety & Security Platform

An offline-first, **multi-agency** field-operations mobile app for Nigerian road safety and
security agencies — **FRSC** (Federal Road Safety Corps), **NPF** (Nigeria Police Force), and
**VIO** (Vehicle Inspection Office). Officers report and manage incidents, look up vehicles,
run duty/patrol logs, and collaborate across agencies; citizens can report stolen vehicles and
track them by reference number — all working fully offline with local persistence.

> The codebase is a **pnpm monorepo**. The primary product is the Expo / React Native mobile
> app under `artifacts/mobile`. An Express + TypeScript API server scaffold lives under
> `artifacts/api-server` for the planned backend migration.

---

## Highlights

- **Multi-agency, role-based** — three agencies, three roles (Field/Inspection Officer,
  Supervisor, Commander). A single permissions module (`lib/permissions.ts`) governs every
  capability check; user management and data are scoped to the officer's own agency.
- **Citizen stolen-vehicle loop (end-to-end)** — a citizen submits a report, receives a
  **case reference** (`STV-YYYY-NNNN`), and can **track its status** publicly with no login.
  Police acknowledge → investigate → mark recovered / false alarm, and every change is recorded
  in a per-case audit timeline.
- **Cross-agency collaboration** — explicit **referrals** between agencies, a shared
  stolen-vehicle registry, and **license-plate flags** surfaced during vehicle lookups and
  inspections.
- **Offline-first** — all state persists to `AsyncStorage` and is shaped like a backend
  response, so it can later be swapped for the Postgres/api-server with minimal churn.

---

## Agencies & roles

| Agency | Focus | Roles |
| --- | --- | --- |
| **FRSC** | Road crashes & incidents | Field Officer · Supervisor · Commander |
| **NPF (Police)** | Crime & stolen vehicles | Field Officer · Supervisor · Commander |
| **VIO** | Vehicle inspection & roadworthiness | Inspection Officer · Supervisor · Commander |

### Demo accounts (PIN `1234`)

| ID | Agency | Role | Name |
| --- | --- | --- | --- |
| `FO-001` | FRSC | Field Officer | Okafor Emmanuel |
| `SV-042` | FRSC | Supervisor | Adaeze Nwosu |
| `CMD-007` | FRSC | Commander | Babatunde Adeyemi |

> Additional FRSC officers `FO-022`, `FO-037` use PIN `5678`. Police and VIO demo officers are
> seeded in `context/AuthContext.tsx`.

### Public (no login)

- **Report Stolen Vehicle** — 3-step wizard, GPS + photo capture.
- **View Nearby Alerts** — location-based broadcast radius alerts.
- **Track a Report** — enter a `STV-YYYY-NNNN` reference to see live status + case timeline.

---

## Tech stack

- **Mobile:** Expo SDK 54, React Native, Expo Router (file-based), TypeScript
- **State/persistence:** React Context + `AsyncStorage` (backend-shaped)
- **Maps & location:** `react-native-maps`, `expo-location`
- **Monorepo:** pnpm workspaces, TypeScript project references
- **Backend (scaffold):** Express 5, PostgreSQL + Drizzle ORM, Zod, Orval (OpenAPI codegen)

---

## Repository layout

```
artifacts/
  mobile/        # Expo / React Native app (primary product)
  api-server/    # Express + TypeScript API scaffold (future backend)
lib/             # Shared libraries
scripts/         # Workspace utility scripts
```

Key folders inside `artifacts/mobile`:

```
app/             # Expo Router screens (tabs, police, vio groups, public routes)
context/         # Auth, Incident, Theft, Crime, Inspection, Patrol, Referral providers
components/      # Shared UI (cards, banners, emblems)
hooks/           # useColors, usePermissions, usePlateFlags, ...
data/            # Nigeria states + LGA reference data
```

---

## Running locally

The app runs via Replit **workflows** (each artifact binds to its assigned `PORT`). Do not run
`pnpm dev` at the repo root.

```bash
# Typecheck everything
pnpm run typecheck

# Regenerate API hooks + Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

The mobile app workflow is `artifacts/mobile: expo`; the preview is available through the
Replit preview pane / Expo dev domain.

---

## Project status

See **[PROGRESS.md](./PROGRESS.md)** for a living checklist mapped to the MVP audit, plus a
build log of what shipped each iteration.
