import { mobileApiFetch } from "@/services/apiClient";
import { shouldUseApi } from "@/services/apiConfig";

/**
 * Best-effort sync of patrol duty sessions to the backend duty-session API.
 * The local PatrolContext remains the source of truth for the UI (offline
 * first); these calls mirror duty state server-side when API mode is on.
 */

export async function startDutyOnApi(route: string): Promise<string | null> {
  const api = await mobileApiFetch<{ dutySession?: { id: string } }, { location: Record<string, unknown> }>({
    method: "POST",
    path: "/duty-sessions/start",
    requireAuth: true,
    body: { location: { route } },
  });
  if (api.ok && api.data.dutySession?.id) return api.data.dutySession.id;
  if (!api.ok && shouldUseApi()) {
    console.warn(`[dutyRepository] startDuty fell back to local-only: ${api.error}`);
  }
  return null;
}

export async function endDutyOnApi(
  serverSessionId: string,
  patrolLog: Array<Record<string, unknown>>,
): Promise<void> {
  const api = await mobileApiFetch({
    method: "PATCH",
    path: `/duty-sessions/${encodeURIComponent(serverSessionId)}/end`,
    requireAuth: true,
    body: { patrolLog },
  });
  if (!api.ok && shouldUseApi()) {
    console.warn(`[dutyRepository] endDuty sync failed: ${api.error}`);
  }
}
