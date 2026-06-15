# Mobile API Integration Foundation

The mobile app is currently local/mock first. Existing screens and contexts still use AsyncStorage so the Expo Go demo keeps working offline and without a backend.

## Enable API Mode Later

Set these Expo public environment variables before starting the mobile app:

```sh
EXPO_PUBLIC_USE_API=true
EXPO_PUBLIC_API_BASE_URL=http://YOUR-LAN-IP:8081/api
```

Optional:

```sh
EXPO_PUBLIC_API_TIMEOUT_MS=10000
```

Do not hardcode production URLs in the app bundle. Use environment variables for local, staging, and production builds.

## Migration Boundary

New repository and client files are the boundary between mobile UI and backend integration:

- `services/apiConfig.ts`
- `services/apiClient.ts`
- `services/reportRepository.ts`
- `services/authRepository.ts`
- `services/notificationRepository.ts`

Screens should move to these repositories gradually. If API mode is disabled, the repositories call the existing local services. If API mode is enabled and the API request fails, they fall back to local AsyncStorage.

## Implemented Backend Workflow (Phase 1)

Citizen report submit and tracking are now backed by the API server. When API
mode is enabled, `reportRepository.ts` calls the backend first and falls back to
local AsyncStorage on any failure:

| Repository method               | Backend endpoint                             | Fallback (local mock)            |
| ------------------------------- | -------------------------------------------- | -------------------------------- |
| `submitCitizenReport`           | `POST /api/citizen-reports`                  | `submitCitizenIncidentMock`      |
| `trackCitizenReportByReference` | `GET /api/citizen-reports/track/{reference}` | `findCitizenIncidentByReference` |
| (timeline)                      | `GET /api/citizen-reports/{id}/timeline`     | local report timeline            |

The backend validates the payload with Zod (`CitizenReportSubmissionSchema` in
`lib/api-zod`), generates a unique id + public reference + `submitted` status +
initial timeline entry, and returns a report in the exact shape the mobile
screens expect. Persistence is currently an **in-memory store** behind a
`CitizenReportStore` interface (`artifacts/api-server/src/lib/citizenReportStore.ts`)
so it can later be swapped for Drizzle without changing route handlers.

## Agency Workflows (Phase 2)

Agency dashboards, report lists, status updates, and admin reassignment are now
backed by the same in-memory store. The agency list/dashboard screens and the
admin incidents screen call `reportRepository.ts`, which is API-first with the
existing AsyncStorage fallback:

| Repository method      | Backend endpoint                          | Fallback (local mock)               |
| ---------------------- | ----------------------------------------- | ----------------------------------- |
| `listReports`          | `GET /api/reports`                        | `listCitizenIncidentReports`        |
| `listReportsByAgency`  | `GET /api/agencies/{agency}/reports`      | `listCitizenIncidentReportsByAgency`|
| `getReportById`        | `GET /api/reports/{id}`                   | `findCitizenIncidentByReference`    |
| `updateReportStatus`   | `PATCH /api/reports/{id}/status`          | `updateCitizenIncidentStatusMock`   |
| `reassignReport`       | `POST /api/reports/{id}/reassign`         | `reassignCitizenIncidentAgencyMock` |
| `appendTimelineEntry`  | `POST /api/reports/{id}/timeline`         | `appendCitizenIncidentTimelineMock` |

Plus a metrics endpoint for dashboards: `GET /api/agencies/{agency}/dashboard`
returns `{ total, submitted, triaged, assigned, in_progress, resolved, closed,
rejected, highPriority, withCoordinates, withoutCoordinates }`. (Mobile
dashboards currently compute their own counts from `listReportsByAgency`, so the
metrics endpoint is available but not yet consumed by a screen.)

Notes:
- Agency filtering uses the report's **current** agency (after any reassignment).
- `reassignReport` updates the owning agency and the track/list/detail responses
  report it as `suggestedAgency`, so Citizen Track and the new agency's list both
  reflect the move.
- Status accepts `submitted | triaged | assigned | in_progress | resolved | closed | rejected`.
- Wired screens: FRSC home + cases, Police home + crime-reports, VIO home +
  inspections, NSCDC home + incidents, Admin home + incidents (status + reassign).
  Maps and notifications are unchanged (still local) to avoid regressions.
- Persistence remains **in-memory** (`InMemoryCitizenReportStore`); restarting
  the API server clears reports. Swapping to Drizzle later does not touch routes
  or mobile.

### Manual API-mode test flow

1. Local mode (no env vars): confirm FRSC/Police/VIO/NSCDC/Admin lists, status
   updates, and admin reassignment still work (AsyncStorage).
2. `nvm use 22 && pnpm --filter @workspace/api-server run dev` to start the API.
3. Set `EXPO_PUBLIC_USE_API=true` and `EXPO_PUBLIC_API_BASE_URL=http://<MAC-LAN-IP>:8081/api`, restart Expo.
4. Submit a citizen report; note its reference and routed agency.
5. Log in as that agency — the report appears in the dashboard/list.
6. Advance its status; open Citizen Track Report — the status reflects the update.
7. As Admin, reassign it to another agency; that agency's list now shows it.
8. Stop the API server — the app falls back to local data without crashing.

### Start the API server

```sh
# From the repo root (Node 22+ required by pnpm)
nvm use 22
pnpm --filter @workspace/api-server run dev
# Serves the API under /api (e.g. GET /api/healthz)
```

### Enable API mode in Expo Go (iPhone)

Set the Expo public env vars before `expo start`:

```sh
EXPO_PUBLIC_USE_API=true
EXPO_PUBLIC_API_BASE_URL=http://<YOUR-MAC-LAN-IP>:8081/api
```

- **iPhone / Expo Go cannot reach `localhost`** — `localhost` resolves to the
  phone itself. Use your Mac's local network IP (e.g.
  `http://192.168.1.42:8081/api`). Find it with `ipconfig getifaddr en0`.
- The phone and Mac must be on the same Wi-Fi/LAN.
- Do not use Expo web mode for this workflow.
- API mode is **disabled by default**: with the vars unset, the app stays fully
  local/offline and every demo flow keeps working.

## Maps, Notifications & Metrics (Phase 3)

Maps, notifications, and dashboard metrics are now backend-ready, all behind the
same API-first + AsyncStorage fallback.

### Notification endpoints

| Repository method (`notificationRepository.ts`) | Backend endpoint                          | Fallback (`notificationService.ts`)   |
| ------------------------------------------------ | ----------------------------------------- | -------------------------------------- |
| `listNotifications`                              | `GET /api/notifications`                  | local list (agency/admin/citizen/user) |
| `markRead`                                       | `PATCH /api/notifications/:id/read`       | `markNotificationRead`                 |
| `markAllRead`                                    | `PATCH /api/notifications/read-all`       | `markAllNotificationsRead`             |
| `unreadCount`                                    | `POST /api/notifications/unread-count`    | `getUnreadNotificationCount`           |
| `createAppNotification`                          | `POST /api/notifications`                 | `createNotification`                   |
| `savePushToken`                                  | `POST /api/push-tokens`                   | local push-token save                  |

`GET /api/notifications` accepts `agency`, `audience`, `userId`, and
`reportReference` query params. The push-token endpoint accepts
`token`/`platform`/`userId`/`agency`, stores it in-memory, and returns success
(no real push delivery yet). The Notification Centre now reads through the
repository, so it shows backend notifications in API mode and local ones
otherwise. Notification **preferences** remain local only.

### Server-created notifications (event hooks)

The backend creates notifications automatically (no mobile call needed):

- **Report submitted** → citizen confirmation + target-agency notification; a
  **high-priority** alert too when the report is `high`/`critical`.
- **Status changed** → citizen notification + owning-agency notification.
- **Report reassigned** → citizen notification, target-agency notification, and
  an admin history notification. Timeline entries are unchanged.

### Maps

All agency maps and the admin map load reports through `reportRepository`
(`listReportsByAgency` / `listReports`), so in API mode they show backend
reports; agency maps show only that agency's reports, the admin map shows all.
GPS reports render as markers; coordinate-less reports stay in the tappable
fallback list; marker/card tap still opens the report summary. Local mode uses
the same AsyncStorage data as before. The native interactive MapView is
unchanged.

### Server dashboard metrics

`GET /api/agencies/:agency/dashboard` returns server-computed counts. The
**NSCDC dashboard** consumes it via `getAgencyMetrics("civil_defence")` and falls
back to client-side computation when the API is disabled/unavailable. FRSC,
Police, and VIO dashboards blend citizen reports with local/legacy sources, so
they keep computing client-side from their already-backend-backed report lists
(the metrics endpoint is available for them but intentionally not wired, to
avoid disturbing the blended stats). Admin uses the all-reports list summary.

### Manual API-mode test steps

1. Local mode (no env vars): confirm maps, notifications, and dashboards work.
2. `nvm use 22 && pnpm --filter @workspace/api-server run dev`.
3. Set `EXPO_PUBLIC_USE_API=true` + `EXPO_PUBLIC_API_BASE_URL=http://<MAC-LAN-IP>:8081/api`, restart Expo.
4. Submit a citizen report; note its agency.
5. Log in as that agency: dashboard metrics reflect it, the agency map shows it
   (tap a GPS marker and a manual-location fallback item).
6. Open the Notification Centre — the agency notification appears.
7. Update status — a status notification is created.
8. As Admin, reassign — the target agency's map/list/notifications update.
9. Stop the API server — the app falls back to local data without crashing.

## Citizen Chat Assistant (Claude + Gemini)

The app has an in-app safety assistant (Public Access → **Ask Assistant** on the
landing screen, route `app/assistant.tsx`). It is backed by the API server,
which calls **Anthropic Claude** or **Google Gemini** depending on server config.
API keys stay server-side; the mobile app never holds them.

| Repository method      | Backend endpoint           | Fallback                             |
| ---------------------- | -------------------------- | ------------------------------------ |
| `sendAssistantMessage` | `POST /api/assistant/chat` | local rule-based responder (offline) |

Configure the provider on the **API server** (not in the mobile bundle):

```sh
# Anthropic Claude (default provider)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# optional: ANTHROPIC_MODEL=claude-opus-4-8   (default)

# or Google Gemini
AI_PROVIDER=gemini
GEMINI_API_KEY=...            # or GOOGLE_API_KEY
# optional: GEMINI_MODEL=gemini-2.5-flash      (default)
```

If no key is configured the endpoint returns `503` and the mobile app falls back
to a local keyword responder, so the chat still works offline in the demo. The
provider abstraction lives in `artifacts/api-server/src/lib/assistant.ts`
(uses the official `@anthropic-ai/sdk` and `@google/genai` SDKs).

> The API server requires **Node 22** (pnpm). In a Node 20 shell, switch with
> `nvm use 22` before `pnpm install` / running the server.

## PostgreSQL Persistence (Phase 4)

The API server now persists citizen reports, timelines, status/reassignment, and
notifications to **PostgreSQL via Drizzle** when a database is configured, and
falls back to in-memory storage otherwise. This is a **backend (api-server)**
concern — the mobile app and its AsyncStorage fallback are unchanged.

### Store selection

`citizenReportStore` and `notificationStore` are chosen once at startup:

- **`DATABASE_URL` set** → Drizzle/Postgres store. The server logs
  `Citizen report store: PostgreSQL (Drizzle)` / `Notification store: PostgreSQL (Drizzle)`.
- **`DATABASE_URL` unset** → in-memory store. The server logs a `WARN`:
  `... in-memory fallback (... resets on restart)`. Local dev never crashes when
  Postgres is absent (`lib/db` constructs the client lazily).

### Tables (in `lib/db/src/schema/index.ts`)

Three minimal, self-contained tables mirror the mobile models (agency stored as a
plain id so DSS/Fire Service/custom agencies work without a tenant row):

- `citizen_reports` — id, reference (unique), incident type, description, emergency
  level, suggested + assigned agency, status (`case_status` enum incl. `rejected`),
  flat location (`location`, latitude, longitude, address, state, lga,
  locationSource, accuracy), vehicle registration, photo uri, `timeline` (jsonb),
  submittedAt/createdAt/updatedAt.
- `citizen_notifications` — full `AppNotification` shape + `read_at`.
- `push_tokens` — token (unique), platform, userId, agency.

The existing tenant-scoped `cases` table is left unchanged (different shape/FKs).

### Running with PostgreSQL

```sh
# 1. Provision a database and export its URL
export DATABASE_URL="postgresql://user:pass@localhost:5432/nsa"

# 2. Create/sync tables (Node 22 + pnpm)
nvm use 22
pnpm --filter @workspace/db run push          # or push-force (non-interactive)

# 3. Start the API server with the same DATABASE_URL
pnpm --filter @workspace/api-server run dev
```

### Fallback behaviour & warning

- With no `DATABASE_URL`, the server runs fully in **in-memory mode** — submit,
  track, agency lists, dashboard metrics, status, reassignment, and notifications
  all work, but **data resets on every server restart**.
- DB mode persists across restarts: a report submitted (and its timeline / status /
  reassignment) is still trackable by reference after the server is restarted.
- Mobile AsyncStorage fallback is independent and always available regardless of
  backend store.

## Authentication & RBAC (Phase 5)

The backend now has a token-based auth foundation with server-enforced
role-based access control. The mobile app keeps **local/mock login** as the
source of truth for the demo and acquires a backend session token best-effort
when API mode is on.

### Auth endpoints

| Method | Endpoint           | Notes                                                              |
| ------ | ------------------ | ------------------------------------------------------------------ |
| POST   | `/api/auth/login`  | `{ badgeNumber, pin, agency? }` → `{ token, user, agency, role, capabilities }`. PINs are never returned. |
| POST   | `/api/auth/logout` | Stateless — the client discards its token. Returns `{ ok: true }`. |
| GET    | `/api/auth/me`     | Requires `Authorization: Bearer <token>`; returns the user from the token. |

OTP / PIN-reset endpoints are not implemented server-side yet (the mobile
`authRepository` calls fall back to the local OTP flow).

### Token / session approach

- **Stateless HMAC token** (no session store): `base64url(claims).hmacSHA256`,
  signed with `AUTH_SECRET` (set it in production — a dev default is used and a
  warning logged otherwise). Claims carry `sub`, `badgeNumber`, `agency`, `role`,
  `exp` (12h). Tokens remain valid across server restarts while the secret is stable.
- Backend user resolution uses a **demo user repository** (in-memory) behind an
  `authenticate()` abstraction — a DB-backed implementation can replace it once
  users are seeded in the flat agency/role/pin model. Demo credentials (all PIN
  `1234`): `ADMIN-001` (admin), `SUPER-001` (super_admin), `FO-001` (FRSC),
  `NPF-001` (police), `VIO-001` (vio), `NSCDC-001` (NSCDC), and any
  `{PREFIX}-001 | {PREFIX}-SV | {PREFIX}-CMD` for a given agency (covers dynamic
  DSS / Fire Service / custom agencies → officer / supervisor / commander).

### RBAC (server-enforced — never trusts client agency/role headers)

- **Public** (no token): health check, `POST /citizen-reports`,
  `GET /citizen-reports/track/:reference`, `GET /citizen-reports/:id/timeline`.
- **Agency users** (officer/supervisor/commander): may list / view / update
  status / append timeline for **their own agency's** reports only.
- **Admin / super_admin**: list all reports (`GET /reports`), reassign reports,
  and access any agency. **Reassignment is admin-only.**
- Cross-agency or unauthenticated access to agency/admin endpoints returns
  `403` / `401`.

### API-mode login flow & local fallback

1. `AuthContext.login()` resolves the user **locally** (demo records) — this is
   unchanged and always works offline.
2. On success, in API mode it fires `establishApiSession(badge, pin, agency)`
   (best-effort, non-blocking) which calls `POST /api/auth/login` and persists
   the bearer token via `setMobileApiToken` (AsyncStorage).
3. `apiClient.mobileApiFetch` automatically attaches `Authorization: Bearer
   <token>` on `requireAuth` calls (agency lists, dashboards, status, reassign…).
4. If API mode is off, the backend is unavailable, or login fails, no token is
   stored — protected calls 401 and the report/notification repositories fall
   back to AsyncStorage/local. Local login is never blocked.
5. `logout()` clears the token (`clearApiSession`).

### Security notes

- **No API keys live in the mobile bundle.** Only a short-lived session token is
  stored on-device, obtained from the backend after login.
- The token is currently kept in **AsyncStorage**; migrate to
  `expo-secure-store` (device keychain/keystore) before production — noted in
  `apiClient.ts`.
- `AUTH_SECRET` must be set on the server in production; the demo PIN auth is for
  development only and should be replaced by DB-backed users + hashed PINs.

## Backend Notes

The repository already has:

- Express API server in `artifacts/api-server`
- OpenAPI spec in `lib/api-spec/openapi.yaml` (citizen-report paths corrected to
  `/citizen-reports`, `/citizen-reports/track/{reference}`,
  `/citizen-reports/{reportId}/timeline`)
- generated client package in `lib/api-client-react`
- Zod schemas in `lib/api-zod`
- Drizzle/PostgreSQL schema in `lib/db`

## Fallback Rules

- `EXPO_PUBLIC_USE_API` must be exactly `true`.
- `EXPO_PUBLIC_API_BASE_URL` must be present.
- Missing config, request timeout, network failure, non-2xx response, or unexpected response shape should keep the local/mock flow alive.
- AsyncStorage should remain available for offline mode and future sync queues.
