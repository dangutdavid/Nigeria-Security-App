# Nigeria Security App

Integrated mobile-first safety and field-operations platform for Nigerian public-safety agencies.

The project currently focuses on an Expo React Native app with local/mock data that can progressively move to the API server. It supports citizen incident reporting, agency dashboards, admin oversight, map/location support, notifications, dynamic agency onboarding, and backend-ready contracts.

## What Is Built

### Mobile App (`artifacts/mobile`)

- Citizen/public access:
  - Submit incident reports.
  - Track report status by reference number.
  - Report stolen vehicles.
  - View nearby alerts and emergency contacts.
  - Use the safety assistant.
- Role-based login:
  - Citizen/public access remains open.
  - Agency users sign in with badge number and PIN.
  - Admin and super-admin have platform oversight tools.
- Supported dedicated agency workspaces:
  - FRSC
  - Nigeria Police Force
  - VIO
  - NSCDC / Civil Defence
  - Admin
- Dynamic agency support:
  - Admin can add agencies such as DSS, Fire Service, or Custom.
  - Added agencies get seeded demo users.
  - Added agencies get seeded operational reports.
  - Added agencies open a scalable generic workspace with Home, Reports, Map, and Tools.
  - Admin remains last in agency lists.
- Admin tools:
  - Agency management.
  - User management.
  - Cross-agency incidents and reassignment.
  - Referrals.
  - Audit log.
  - Map and workload views.
- Local/mock data:
  - AsyncStorage-backed report, user, agency, notification, and audit flows.
  - API-first repository layer with local fallback.
- Notifications:
  - In-app notification centre.
  - Local notification preferences.
  - Push-token readiness.
- Maps/location:
  - GPS/manual location support.
  - Native/fallback map views.
  - Coordinate-safe report display.

### API Server (`artifacts/api-server`)

- Express API server under `/api`.
- Health route.
- Citizen report routes.
- Report list/detail/status/reassignment routes.
- Notification routes with authorization scoping.
- Assistant route support.
- In-memory fallback stores.
- PostgreSQL/Drizzle persistence path documented and partially wired.

### Shared Libraries

- `lib/api-spec`: OpenAPI contract.
- `lib/api-zod`: shared Zod schemas.
- `lib/api-client-react`: generated API client package.
- `lib/db`: Drizzle/PostgreSQL schema.

## Repository Layout

```text
artifacts/
  mobile/           Expo React Native app
  api-server/       Express API server
  mockup-sandbox/   separate mockup sandbox
lib/
  api-spec/         OpenAPI contract and codegen config
  api-zod/          shared Zod schemas
  api-client-react/ generated API client package
  db/               Drizzle/PostgreSQL schema
scripts/            workspace scripts
```

## Requirements

- Node 22.13+ is required for the current pnpm version.
- pnpm is required by the workspace.
- Expo Go is used for mobile testing.

If your shell is on Node 20, workspace pnpm commands fail with `node:sqlite` errors. Use Node 22 before running pnpm:

```sh
nvm use 22
```

## Install

```sh
pnpm install
```

## Run the Mobile App

From the repo root:

```sh
pnpm --filter @workspace/mobile run dev
```

For Expo Go on iPhone, use the QR code from Expo. Do not use Expo web mode for mobile verification unless explicitly testing web.

## Run the API Server

```sh
nvm use 22
pnpm --filter @workspace/api-server run dev
```

The API is served under `/api`, for example:

```text
GET /api/healthz
```

## Database Setup (Postgres Persistence)

The server persists to PostgreSQL when `DATABASE_URL` is set. Without it, the
server falls back to in-memory stores — this is an explicit local-dev/demo
fallback only; data resets on every restart.

```sh
createdb nigeria_security
export DATABASE_URL=postgres://YOUR-USER@localhost:5432/nigeria_security

# Generate migrations after schema changes in lib/db/src/schema
pnpm --filter @workspace/db run generate

# Apply migrations (tracked in lib/db/migrations)
pnpm --filter @workspace/db run migrate

# Start the server with persistence enabled
DATABASE_URL=$DATABASE_URL pnpm --filter @workspace/api-server run dev
```

`GET /api/healthz` reports the active persistence mode:
`{"status":"ok","db":"postgres"}` or `{"status":"ok","db":"in-memory"}`, and
returns HTTP 503 with `db: "error"` when the database is unreachable.

Rollback note: migrations are forward-only SQL files in `lib/db/migrations`.
To roll back a bad migration in development, drop and recreate the database,
then re-run `migrate`.

## Enable API Mode in the Mobile App

The app is local/mock first. To enable API-first calls:

```sh
EXPO_PUBLIC_USE_API=true
EXPO_PUBLIC_API_BASE_URL=http://YOUR-LAN-IP:8081/api
```

On iPhone, do not use `localhost`; use your Mac's LAN IP.

## Demo Accounts

PIN is usually `1234`.

### Admin

- `ADMIN-001`
- `SUPER-001`

### FRSC

- `FO-001`
- `SV-042`
- `CMD-007`

### Police

- `NPF-001`
- `NPF-042`
- `NPF-CMD`

### VIO

- `VIO-001`
- `VIO-SV2`
- `VIO-CMD`

### NSCDC

- `NSCDC-001`
- `NSCDC-SV`
- `NSCDC-CMD`

### Admin-Added Agencies

When Admin adds an agency, the app seeds:

- `{PREFIX}-001`
- `{PREFIX}-SV`
- `{PREFIX}-CMD`

All use PIN `1234`.

## Key Mobile Flows to Test

1. Citizen submits a report.
2. Citizen tracks the report by reference number.
3. FRSC/Police/VIO/NSCDC user logs in and updates routed reports.
4. Admin reassigns a report to another agency.
5. Citizen Track Report reflects status and agency changes.
6. Admin adds DSS, Fire Service, or Custom.
7. New agency user logs in and sees the generic agency workspace.
8. New agency has seeded reports, metrics, map fallback, notifications, and tools.
9. Admin deactivates an agency and confirms it is hidden from login.
10. Unauthorized route handling still works.

## Verification

Preferred workspace check:

```sh
pnpm --filter @workspace/mobile run typecheck
```

If pnpm fails because the shell uses Node 20, run direct TypeScript from the mobile package:

```sh
cd artifacts/mobile
./node_modules/.bin/tsc -p tsconfig.json --noEmit
```

Diff hygiene:

```sh
git diff --check -- artifacts/mobile
```

API/server checks:

```sh
./node_modules/.bin/tsc -p artifacts/api-server/tsconfig.json --noEmit
./node_modules/.bin/tsc -p lib/api-zod/tsconfig.json --noEmit
./node_modules/.bin/tsc -p lib/db/tsconfig.json --noEmit
```

## Security Notes

This is a security system, so the intended production direction is:

- Server-side authorization for every agency/admin route.
- Agency ownership boundaries enforced on the backend.
- Admin visibility across all records.
- Audit logs for auth, report, user, agency, notification, and reassignment actions.
- Secure token storage on mobile.
- Rate limiting and validation on public report endpoints.
- Secure evidence/photo upload with metadata, size/type validation, and signed URLs.
- PostgreSQL persistence with migrations and backups.

## Remaining Production Work

- Complete real backend persistence for every flow.
- Regenerate and adopt generated API clients after OpenAPI changes.
- Replace AsyncStorage flows feature by feature with backend calls.
- Add full dynamic agency configuration and routing rules.
- Add production push notification delivery.
- Add secure evidence upload.
- Add automated mobile regression tests.
- Add deployment configuration for staging and production.
- Perform real-device QA on iPhone and Android.

## Important Scope Note

`artifacts/mockup-sandbox` is separate from the mobile app and should not be touched during mobile implementation unless explicitly requested.
