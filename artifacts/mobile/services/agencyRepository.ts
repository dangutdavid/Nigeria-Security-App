import type { AgencyConfig } from "@/context/AgencyContext";
import { mobileApiFetch } from "@/services/apiClient";
import { shouldUseApi } from "@/services/apiConfig";

/**
 * API-first agency registry access. AgencyContext stays the source of truth
 * for the UI (with AsyncStorage persistence as the offline cache); these
 * helpers sync the registry with the backend when API mode is on.
 */

interface ServerAgency {
  id: string;
  name: string;
  shortName: string;
  fullName: string;
  primaryColor: string;
  secondaryColor: string;
  badgePrefix: string;
  description: string;
  icon?: string | null;
  isActive: boolean;
}

const BUILT_IN_TAB_ROUTES: Record<string, string> = {
  frsc: "/(tabs)",
  police: "/(police)",
  vio: "/(vio)",
  civil_defence: "/(civil-defence)",
  admin: "/(admin)",
};

function toAgencyConfig(server: ServerAgency): AgencyConfig {
  return {
    id: server.id,
    name: server.name,
    shortName: server.shortName,
    fullName: server.fullName,
    primaryColor: server.primaryColor,
    secondaryColor: server.secondaryColor,
    badgePrefix: server.badgePrefix,
    description: server.description,
    icon: server.icon ?? "shield",
    tabRoute: BUILT_IN_TAB_ROUTES[server.id] ?? "/agency-workspace",
    isActive: server.isActive,
  };
}

function logFallback(method: string, error: string) {
  if (shouldUseApi()) {
    console.warn(`[agencyRepository] ${method} fell back to local registry: ${error}`);
  }
}

/** Fetch the backend agency registry; null when API mode is off/unreachable. */
export async function listAgenciesFromApi(): Promise<AgencyConfig[] | null> {
  const api = await mobileApiFetch<{ agencies?: ServerAgency[] }>({
    method: "GET",
    path: "/agencies?includeInactive=true",
  });
  if (api.ok && api.data.agencies) return api.data.agencies.map(toAgencyConfig);
  if (!api.ok) logFallback("listAgenciesFromApi", api.error);
  return null;
}

/** Best-effort create on the backend registry (admin bearer token required). */
export async function createAgencyOnApi(agency: AgencyConfig): Promise<void> {
  const api = await mobileApiFetch({
    method: "POST",
    path: "/agencies",
    requireAuth: true,
    body: {
      id: agency.id,
      name: agency.name,
      shortName: agency.shortName,
      fullName: agency.fullName,
      primaryColor: agency.primaryColor,
      secondaryColor: agency.secondaryColor,
      badgePrefix: agency.badgePrefix,
      description: agency.description,
      icon: agency.icon,
      isActive: agency.isActive,
    },
  });
  if (!api.ok) logFallback("createAgencyOnApi", api.error);
}

/** Best-effort update on the backend registry (admin bearer token required). */
export async function updateAgencyOnApi(
  id: string,
  patch: Partial<Pick<AgencyConfig, "name" | "shortName" | "fullName" | "primaryColor" | "secondaryColor" | "badgePrefix" | "description" | "icon" | "isActive">>,
): Promise<void> {
  const api = await mobileApiFetch({
    method: "PATCH",
    path: `/agencies/${encodeURIComponent(id)}`,
    requireAuth: true,
    body: patch,
  });
  if (!api.ok) logFallback("updateAgencyOnApi", api.error);
}
