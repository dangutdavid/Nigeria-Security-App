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
- The token is stored via **expo-secure-store** (keychain/keystore) as of
  Phase 6, with an AsyncStorage fallback only when SecureStore is unavailable.
- `AUTH_SECRET` must be set on the server in production. DB-backed users with
  hashed (scrypt) PINs landed in Phase 7 (below); the demo in-memory repository
  remains the fallback when `DATABASE_URL` is unset.

## Secure Sessions & Protected Notifications (Phase 6)

This phase moves the bearer token into the device keychain/keystore, makes login
establish (and startup validate) the backend session safely, and locks down the
notification endpoints with the same server-enforced RBAC as reports.

### Secure token storage (`services/authToken.ts`)

Token persistence now lives in a dedicated module preferred over AsyncStorage:

- Uses **`expo-secure-store`** (iOS Keychain / Android Keystore) via
  `SecureStore.isAvailableAsync()`, cached per session.
- **AsyncStorage is only a fallback** when SecureStore is unavailable (e.g. some
  web/SSR contexts) or throws; `clearAuthToken` always wipes the AsyncStorage
  copy too, so no stale token lingers.
- Key is `security_api_auth_token_v1` (SecureStore keys must be `[A-Za-z0-9._-]`,
  so no `@` prefix). An in-memory cache avoids repeat reads.
- Helpers: `saveAuthToken`, `getAuthToken`, `clearAuthToken`, `hasAuthToken`.
- `apiClient.ts` re-exports these and keeps auto-attaching `Authorization: Bearer
  <token>` on `requireAuth` calls; `setMobileApiToken(null)` clears on logout.
- **No API keys are ever stored on device** — only the short-lived session token.

### Awaited login session (login-race fix)

`AuthContext.login()` still resolves the user **locally first** (offline demo is
never blocked). In API mode it then **awaits** `establishApiSession(badge, pin,
agency, { timeoutMs: 4000 })` *before returning*, so the token is persisted
before navigation triggers the first protected call — fixing the prior race
where the initial agency/dashboard fetch fired before the token existed. A
slow/unreachable backend is bounded by the 4s timeout and simply leaves the app
in local mode. The context exposes `apiSessionEstablished: boolean` for
debugging (true only when a backend token was obtained/validated).

### Startup token restore & validation

On launch, after restoring the stored user, `validateApiSession()`:

- returns early if API mode is off or no token is stored;
- otherwise calls `GET /api/auth/me` (bearer, 4s timeout);
- **clears the token only on an explicit `401`/`403`** (expired/invalid);
- on a network error / unreachable backend it **keeps** the token and leaves the
  user logged into local mode — startup never logs the demo user out or crashes.

### Protected notification endpoints (server-enforced RBAC)

`artifacts/api-server/src/routes/notifications.ts` now authorizes every
non-citizen path (same token-claim model as reports — client agency/role headers
are never trusted):

| Endpoint                              | Access rule                                                        |
| ------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/notifications`              | **Public only** when `reportReference` is set (forced to citizen audience). Otherwise requires auth. |
| `POST /api/notifications/unread-count`| Same scoping as list (citizen-by-reference public, else auth).     |
| `PATCH /api/notifications/read-all`   | Same scoping as list.                                              |
| `PATCH /api/notifications/:id/read`   | Requires an authenticated user.                                    |
| `POST /api/notifications`             | Requires auth (server creates report notifications via hooks).     |
| `POST /api/push-tokens`               | Requires auth; `userId`/`agency` are taken from the **token claims**, not the body. |

For authenticated, non-admin users the filter is scoped: requesting
`audience=admin` (or `agency=admin`) → `403`, and a cross-agency `agency` filter
→ `403`. **Admin / super_admin** may query any agency/audience. The citizen
report submit/track flow stays fully public, and citizen notification lookup by
report reference needs no token.

### Mobile repository behaviour (unchanged contract)

`notificationRepository.ts` already sends the bearer token on the protected
calls (`requireAuth` is set for everything except citizen / by-reference reads)
and **falls back to the local `notificationService` on any non-2xx (incl.
401/403)**, so the Notification Centre keeps working in local mode and when a
token is missing/expired. Notification **preferences** remain local-only.

### iPhone / Expo Go notes

- SecureStore works in Expo Go on a physical iPhone; no extra native build is
  required for the demo. The `expo-secure-store` config plugin is registered.
- API-mode env vars and the `localhost`-vs-LAN-IP rule from Phase 2/3 still
  apply (`EXPO_PUBLIC_USE_API`, `EXPO_PUBLIC_API_BASE_URL=http://<MAC-LAN-IP>:8081/api`).
- Do not use Expo web mode for this workflow.

### Manual API-mode test steps

1. Local mode (no env vars): log in, open Notification Centre, mark read —
   everything works offline (token never created).
2. `nvm use 22 && pnpm --filter @workspace/api-server run dev`.
3. Set `EXPO_PUBLIC_USE_API=true` + `EXPO_PUBLIC_API_BASE_URL=http://<MAC-LAN-IP>:8081/api`, restart Expo.
4. Log in as an agency user — `apiSessionEstablished` is true; the first
   dashboard/list call carries the token (no 401 race).
5. Open the Notification Centre — agency notifications load over the bearer token.
6. Kill and relaunch the app — the session is restored from SecureStore and
   validated via `/auth/me`; you stay logged in.
7. Hit `GET /api/notifications?audience=admin` as a non-admin token → `403`;
   without a token → `401`; with `?reportReference=...` and no token → returns
   the citizen notifications for that reference.
8. Stop the API server — the app falls back to local notifications without
   crashing and the stored token is kept (no spurious logout).

## DB-Backed Auth Users (Phase 7)

Backend authentication now resolves users from a repository that is **DB-backed
when `DATABASE_URL` is set** and **demo/in-memory otherwise**. PINs are stored
only as salted hashes; the mobile local/mock login fallback is unchanged.

### Auth repository selection

Chosen once at startup (mirrors the report/notification stores), logged clearly:

- **`DATABASE_URL` set** → `Auth repository: PostgreSQL (Drizzle)`. Users live in
  the new `auth_users` table.
- **`DATABASE_URL` unset** → `Auth repository: demo in-memory fallback …`
  (a `WARN`). Local dev never crashes when Postgres is absent.

### `auth_users` table (`lib/db/src/schema/index.ts`)

A flat, self-contained table (like `citizen_reports`) — agency is a plain id so
DSS / Fire Service / custom agencies need no tenant row. The existing
tenant-scoped `users` table (referenced by cases/evidence/referrals) is left
unchanged.

| Column | Notes |
| --- | --- |
| `id` | uuid PK |
| `badge_number` | unique login identifier (uppercased) |
| `display_name` | shown to the user |
| `agency` | plain agency id (`frsc`/`police`/`vio`/`civil_defence`/`admin`/`dss`/`fire_service`/`custom`…) |
| `role` | `userRole` enum (citizen…super_admin) |
| `pin_hash` | salted **scrypt** hash — never plaintext |
| `is_active` | inactive users are rejected at login |
| `created_at`/`updated_at`/`last_login_at` | timestamps |

### PIN hashing

`artifacts/api-server/src/lib/password.ts` uses Node's built-in **scrypt**
(`node:crypto`, no new dependency). Format: `scrypt$<N>$<saltHex>$<hashHex>`,
fresh 16-byte salt per hash, constant-time verification via `timingSafeEqual`.
**`pin_hash` is never returned by any endpoint.**

### Demo user seeding (DB mode)

On startup `initAuth()` idempotently seeds the documented demo users
(`onConflictDoNothing` on the unique badge index — **never duplicates on
restart**; logs `created: N`):

`ADMIN-001` (admin), `SUPER-001` (super_admin), `FO-001` (frsc),
`NPF-001` (police), `VIO-001` (vio), `NSCDC-001` (civil_defence) — all PIN `1234`.

**Dynamic agencies** (`{PREFIX}-001 | -SV | -CMD` → officer/supervisor/commander)
are open-ended (custom agencies can't all be pre-seeded), so they're resolved by
a **demo-pattern fallback** when there's no `auth_users` row, with the demo PIN —
in both repository modes. This preserves DSS / Fire Service / custom agency demo
logins. Replace this fallback with real seeded/managed users before production.

### Endpoints (unchanged contract)

- `POST /api/auth/login` — authenticates against the active repository. Invalid
  PIN → `401`; **inactive account → `403`**. Returns `{ token, user, agency,
  role, capabilities }` (no `pin_hash`). Token claims still carry `sub`,
  `badgeNumber`, `agency`, `role`, `exp`.
- `GET /api/auth/me` and `POST /api/auth/logout` — unchanged; RBAC on report /
  notification routes works without any route change.

### Admin user management (next phase)

The DB repository exposes backend-safe helpers — `createUser`, `updateUser`,
`setActive` (deactivate/reactivate), `resetPin` — ready to wire up. The OpenAPI
contract already defines `/admin/users` (list/create) and
`/admin/users/{userId}` (patch), but those HTTP endpoints are **not implemented
this phase** (no admin-user UI is wired yet, and they need admin-only RBAC +
request schemas). Wiring them is the next phase; the helpers and table are ready.

### Running & testing DB-backed auth

```sh
export DATABASE_URL="postgresql://localhost:5432/nsa"
export AUTH_SECRET="<a strong secret>"   # required in production
nvm use 22
pnpm --filter @workspace/db run push-force   # creates auth_users (+ other tables)
pnpm --filter @workspace/api-server run dev   # logs "Auth repository: PostgreSQL (Drizzle)"
```

- Login: `curl -X POST $BASE/api/auth/login -H 'Content-Type: application/json'
  -d '{"badgeNumber":"ADMIN-001","pin":"1234"}'` → token + user.
- Wrong PIN → `401`; an `is_active=false` user → `403`.
- **Fallback:** with `DATABASE_URL` unset the server uses the demo repository and
  the same demo credentials work — local dev/demo never needs a database.
- Mobile is unchanged: API-mode login still hits `/auth/login`; with API disabled
  or the backend down, the app keeps its local/mock login.

## Admin User Management (Phase 8)

Admin / super_admin can manage backend users through the API while the local
demo Manage Users screen keeps working offline.

### Endpoints (admin/super_admin only — server-enforced RBAC)

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/api/admin/users` | List users. Optional `agency`, `role`, `status` filters. **Never returns the PIN hash.** |
| POST | `/api/admin/users` | Create user (`badgeNumber`, `displayName`, `agency`, `role`, `pin`, optional `isActive`). `409` on duplicate badge. |
| PATCH | `/api/admin/users/:userId` | Update safe fields (`displayName`, `agency`, `role`, `isActive`). |
| DELETE | `/api/admin/users/:userId` | **Deactivate** (soft delete — sets `isActive=false`); never a hard delete. Cannot deactivate your own account (`400`). |
| POST | `/api/admin/users/:userId/reset-pin` | Hash and store a new PIN. |

- **Unauthenticated → `401`; non-admin → `403`.** A new/updated user appears in
  the list immediately; a deactivated user is rejected at login (`403`).
- **Demo (no `DATABASE_URL`) mode:** `GET` returns the seeded demo users
  (read-only) so the screen still renders; write operations return **`501`**
  (user management requires the database).
- Validation: `AdminUserCreateSchema` / `AdminUserUpdateSchema` /
  `AdminUserResetPinSchema` in `lib/api-zod`. `agency` is a free string so
  built-in **and** dynamic/custom agency ids (DSS, Fire Service, custom) are
  accepted; PIN is `4–12` chars (demo-friendly).

### Mobile Manage Users behaviour

`artifacts/mobile/services/userRepository.ts` is API-first with local fallback
(bearer token attached automatically via `apiClient`):

| Repository method | Backend endpoint | Local fallback |
| --- | --- | --- |
| `listUsers` | `GET /admin/users` | local `allUsers` |
| `createUser` | `POST /admin/users` | `AuthContext.addUser` |
| `updateUser` | `PATCH /admin/users/:id` | `AuthContext.updateUser` |
| `deactivateUser` / `reactivateUser` | `DELETE` / `PATCH isActive` | local status update |
| `removeUser` (form Delete) | `DELETE /admin/users/:id` (soft) | local hard delete |
| `resetPin` | `POST /admin/users/:id/reset-pin` | `AuthContext.resetPin` |

- **API mode:** the Manage Users screen (`app/(admin)/users.tsx`) fetches backend
  users on focus and merges them into the in-memory store for display/edit
  (`AuthContext.mergeApiUsers` — **not persisted**, so the offline demo store is
  never polluted). Create/edit/deactivate/reactivate/reset-PIN call the backend.
- **Local mode or API failure/401/403:** the same screen and form fall back to
  the existing local user management — the offline demo is never broken.
- The backend auth model is lean: contact fields (email/phone/sector/station)
  are **local-only** and not sent to the API. The user form requires them only
  when creating a local user; they're optional when editing a backend user.
- iPhone safe-area layout is unchanged.

### Security & audit

- **PIN hashes are never returned** by any endpoint, and the mobile app never
  receives or stores them.
- Mobile audit events (`user.created` / `updated` / `deleted` / `pin_reset`) are
  recorded by the local user-management path (local mode and on API fallback).
  **Follow-up:** backend-side audit logging for API-mode mutations is not wired
  yet — the lean `auth_users` model isn't linked to the tenant-scoped
  `audit_logs` table (whose `actor_id` references the tenant `users` table). Add
  a flat audit writer in a later phase.

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
