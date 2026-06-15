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

## First Feature To Migrate

Migrate citizen report submit and tracking first:

1. `submitCitizenReport`
2. `trackCitizenReportByReference`
3. report status/timeline updates

This is the safest path because it validates routing, tracking reference numbers, location fields, status history, notifications, and agency dashboards without replacing the whole auth layer.

## Current Backend Notes

The repository already has:

- Express API server in `artifacts/api-server`
- OpenAPI spec in `lib/api-spec/openapi.yaml`
- generated client package in `lib/api-client-react`
- Zod schemas in `lib/api-zod`
- Drizzle/PostgreSQL schema in `lib/db`

The OpenAPI spec currently documents only health-check. Expand it before switching screens to generated API hooks.

## Fallback Rules

- `EXPO_PUBLIC_USE_API` must be exactly `true`.
- `EXPO_PUBLIC_API_BASE_URL` must be present.
- Missing config, request timeout, network failure, non-2xx response, or unexpected response shape should keep the local/mock flow alive.
- AsyncStorage should remain available for offline mode and future sync queues.
