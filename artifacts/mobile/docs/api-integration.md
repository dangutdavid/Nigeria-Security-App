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
