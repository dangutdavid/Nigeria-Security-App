import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AgencyType } from "@/context/AuthContext";
import { createAuditEvent } from "@/services/auditLogService";
import {
  createAgencyOnApi,
  listAgenciesFromApi,
  updateAgencyOnApi,
} from "@/services/agencyRepository";

export type AgencyId = AgencyType | string;

export interface AgencyConfig {
  id: AgencyId;
  name: string;
  shortName: string;
  fullName: string;
  primaryColor: string;
  secondaryColor: string;
  badgePrefix: string;
  description: string;
  icon: string;
  tabRoute: string;
  isActive: boolean;
}

export type NewAgencyInput = Omit<AgencyConfig, "id" | "tabRoute" | "isActive"> & {
  id?: string;
  isActive?: boolean;
};

/** Fields an editor may change. `id` and `tabRoute` are immutable (routing keys). */
export type AgencyUpdateInput = Partial<Omit<AgencyConfig, "id" | "tabRoute">>;

export const DEFAULT_AGENCIES: AgencyConfig[] = [
  {
    id: "frsc",
    name: "FRSC",
    shortName: "FRSC",
    fullName: "Federal Road Safety Corps",
    primaryColor: "#1B5E3B",
    secondaryColor: "#2E7D52",
    badgePrefix: "FO/SV/CMD",
    description: "Road traffic management, crash response & safety enforcement",
    icon: "shield",
    tabRoute: "/(tabs)",
    isActive: true,
  },
  {
    id: "police",
    name: "Nigeria Police",
    shortName: "NPF",
    fullName: "Nigeria Police Force",
    primaryColor: "#1A3A6C",
    secondaryColor: "#254E9C",
    badgePrefix: "NPF",
    description: "Crime investigation, law enforcement & public security",
    icon: "star",
    tabRoute: "/(police)",
    isActive: true,
  },
  {
    id: "vio",
    name: "VIO",
    shortName: "VIO",
    fullName: "Vehicle Inspection Officers",
    primaryColor: "#7B3F00",
    secondaryColor: "#A0522D",
    badgePrefix: "VIO",
    description: "Vehicle roadworthiness inspection & certification",
    icon: "clipboard",
    tabRoute: "/(vio)",
    isActive: true,
  },
  {
    id: "civil_defence",
    name: "Civil Defence",
    shortName: "NSCDC",
    fullName: "Nigeria Security and Civil Defence Corps",
    primaryColor: "#234E2A",
    secondaryColor: "#3F7D3A",
    badgePrefix: "NSCDC",
    description: "Civil protection, rescue support & infrastructure security",
    icon: "shield",
    tabRoute: "/(civil-defence)",
    isActive: true,
  },
  {
    id: "admin",
    name: "Admin",
    shortName: "ADMIN",
    fullName: "Security Platform Administration",
    primaryColor: "#344054",
    secondaryColor: "#667085",
    badgePrefix: "ADMIN",
    description: "Cross-agency oversight, users & system operations",
    icon: "settings",
    tabRoute: "/(admin)",
    isActive: true,
  },
];

export const AGENCIES = DEFAULT_AGENCIES;

const STORAGE_KEY = "@frsc_selected_agency";
const AGENCY_REGISTRY_KEY = "@security_agency_registry_v1";

interface AgencyContextType {
  agencies: AgencyConfig[];
  selectedAgency: AgencyConfig | null;
  selectAgency: (id: AgencyId) => Promise<void>;
  clearAgency: () => Promise<void>;
  getAgencyById: (id: AgencyId) => AgencyConfig | undefined;
  addAgency: (input: NewAgencyInput) => Promise<AgencyConfig>;
  updateAgency: (id: AgencyId, updates: AgencyUpdateInput, actorName?: string) => Promise<AgencyConfig>;
  setAgencyActive: (id: AgencyId, isActive: boolean) => Promise<void>;
}

const AgencyContext = createContext<AgencyContextType>({
  agencies: DEFAULT_AGENCIES,
  selectedAgency: null,
  selectAgency: async () => {},
  clearAgency: async () => {},
  getAgencyById: () => undefined,
  addAgency: async () => DEFAULT_AGENCIES[0],
  updateAgency: async () => DEFAULT_AGENCIES[0],
  setAgencyActive: async () => {},
});

export function useAgency() {
  return useContext(AgencyContext);
}

/**
 * Resolve an agency's brand colours from the live registry, with safe fallbacks
 * so screens never render invisible text/buttons if a config value is missing.
 * Lets built-in agency screens react to admin/commander colour edits just like
 * dynamic agencies do.
 */
export function useAgencyBrand(
  id: AgencyId,
  fallback: { primary: string; secondary?: string },
) {
  const { getAgencyById } = useAgency();
  const agency = getAgencyById(id);
  return {
    agency,
    primary: agency?.primaryColor || fallback.primary,
    secondary: agency?.secondaryColor || fallback.secondary || fallback.primary,
  };
}

export function AgencyProvider({ children }: { children: React.ReactNode }) {
  const [agencies, setAgencies] = useState<AgencyConfig[]>(DEFAULT_AGENCIES);
  const [selectedAgency, setSelectedAgency] = useState<AgencyConfig | null>(null);

  useEffect(() => {
    async function load() {
      const [selected, registry] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(AGENCY_REGISTRY_KEY),
      ]);
      const storedAgencies = parseStoredAgencies(registry);
      let merged = sortAgencies(mergeAgencies(DEFAULT_AGENCIES, storedAgencies));

      // API-first: adopt the backend registry when available; the local copy
      // above stays as the offline cache.
      const serverAgencies = await listAgenciesFromApi();
      if (serverAgencies && serverAgencies.length > 0) {
        merged = sortAgencies(mergeAgencies(merged, serverAgencies));
        await persistAgencyOverrides(merged);
      }

      setAgencies(merged);
      if (selected) {
        const agency = merged.find((a) => a.id === selected && a.isActive !== false);
        if (agency) setSelectedAgency(agency);
        else await AsyncStorage.removeItem(STORAGE_KEY);
      }
    }

    void load();
  }, []);

  const selectAgency = useCallback(async (id: AgencyId) => {
    const agency = agencies.find((a) => a.id === id && a.isActive !== false) ?? null;
    setSelectedAgency(agency);
    if (agency) await AsyncStorage.setItem(STORAGE_KEY, id);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  }, [agencies]);

  const clearAgency = useCallback(async () => {
    setSelectedAgency(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const getAgencyById = useCallback((id: AgencyId) => agencies.find((a) => a.id === id), [agencies]);

  const addAgency = useCallback(async (input: NewAgencyInput): Promise<AgencyConfig> => {
    const id = normalizeAgencyId(input.id || input.shortName || input.name);
    if (!id) throw new Error("Agency ID is required.");
    if (agencies.some((agency) => agency.id === id)) throw new Error("Agency already exists.");

    const agency: AgencyConfig = {
      ...input,
      id,
      name: input.name.trim(),
      shortName: input.shortName.trim().toUpperCase(),
      fullName: input.fullName.trim(),
      description: input.description.trim(),
      badgePrefix: input.badgePrefix.trim().toUpperCase(),
      icon: input.icon || "shield",
      primaryColor: input.primaryColor || "#344054",
      secondaryColor: input.secondaryColor || "#667085",
      tabRoute: "/agency-workspace",
      isActive: input.isActive ?? true,
    };

    const next = sortAgencies([...agencies, agency]);
    setAgencies(next);
    await persistAgencyOverrides(next);
    // Best-effort backend registry sync; local registry remains the offline cache.
    void createAgencyOnApi(agency);
    await createAuditEvent({
      type: "agency.created",
      title: "Agency registry entry created",
      detail: `${agency.shortName} was added to the frontend agency registry.`,
      actor: { name: "Admin", agency: "admin", role: "admin" },
      agency: agency.id,
      targetId: agency.id,
      severity: "warning",
      metadata: {
        fullName: agency.fullName,
        badgePrefix: agency.badgePrefix,
        tabRoute: agency.tabRoute,
      },
    });
    return agency;
  }, [agencies]);

  const updateAgency = useCallback(async (id: AgencyId, updates: AgencyUpdateInput, actorName = "Admin"): Promise<AgencyConfig> => {
    const target = agencies.find((agency) => agency.id === id);
    if (!target) throw new Error("Agency was not found.");

    // id and tabRoute are immutable routing keys; everything else is editable.
    const { id: _omitId, tabRoute: _omitRoute, ...editable } = updates as AgencyUpdateInput & { id?: string; tabRoute?: string };
    const merged: AgencyConfig = { ...target, ...editable };
    const normalized: AgencyConfig = {
      ...merged,
      name: merged.name.trim(),
      shortName: merged.shortName.trim().toUpperCase(),
      fullName: merged.fullName.trim(),
      description: merged.description.trim(),
      badgePrefix: merged.badgePrefix.trim().toUpperCase(),
      icon: merged.icon || "shield",
      primaryColor: merged.primaryColor || "#344054",
      secondaryColor: merged.secondaryColor || "#667085",
    };
    if (!normalized.shortName) throw new Error("Short name is required.");
    if (!normalized.name) throw new Error("Display name is required.");
    if (!normalized.fullName) throw new Error("Full name is required.");

    const next = sortAgencies(agencies.map((agency) => (agency.id === id ? normalized : agency)));
    setAgencies(next);
    await persistAgencyOverrides(next);
    void updateAgencyOnApi(id, {
      name: normalized.name,
      shortName: normalized.shortName,
      fullName: normalized.fullName,
      primaryColor: normalized.primaryColor,
      secondaryColor: normalized.secondaryColor,
      badgePrefix: normalized.badgePrefix,
      description: normalized.description,
      icon: normalized.icon,
    });
    if (selectedAgency?.id === id) setSelectedAgency(normalized);

    const changedKeys = (Object.keys(editable) as Array<keyof AgencyConfig>).filter(
      (key) => target[key] !== normalized[key],
    );
    await createAuditEvent({
      type: "agency.updated",
      title: "Agency details updated",
      detail: `${normalized.shortName} was updated (${changedKeys.join(", ") || "no changes"}).`,
      actor: { name: actorName, agency: "admin", role: "admin" },
      agency: normalized.id,
      targetId: normalized.id,
      severity: "info",
      metadata: { changed: changedKeys.join(",") },
    });
    return normalized;
  }, [agencies, selectedAgency]);

  const setAgencyActive = useCallback(async (id: AgencyId, isActive: boolean) => {
    const target = agencies.find((agency) => agency.id === id);
    if (!target) throw new Error("Agency was not found.");
    if (target.id === "admin" && !isActive) throw new Error("Admin agency cannot be deactivated.");

    const next = sortAgencies(agencies.map((agency) => (agency.id === id ? { ...agency, isActive } : agency)));
    setAgencies(next);
    await persistAgencyOverrides(next);
    void updateAgencyOnApi(id, { isActive });

    if (!isActive && selectedAgency?.id === id) {
      setSelectedAgency(null);
      await AsyncStorage.removeItem(STORAGE_KEY);
    }

    await createAuditEvent({
      type: "agency.updated",
      title: isActive ? "Agency activated" : "Agency deactivated",
      detail: `${target.shortName} was ${isActive ? "made available" : "removed"} from agency sign in.`,
      actor: { name: "Admin", agency: "admin", role: "admin" },
      agency: target.id,
      targetId: target.id,
      severity: isActive ? "info" : "warning",
      metadata: {
        shortName: target.shortName,
        loginAvailable: isActive,
      },
    });
  }, [agencies, selectedAgency]);

  return (
    <AgencyContext.Provider value={{ agencies, selectedAgency, selectAgency, clearAgency, getAgencyById, addAgency, updateAgency, setAgencyActive }}>
      {children}
    </AgencyContext.Provider>
  );
}

function parseStoredAgencies(raw: string | null): AgencyConfig[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(isAgencyConfig).map((agency) => ({ ...agency, isActive: agency.isActive !== false }))
      : [];
  } catch {
    return [];
  }
}

function isAgencyConfig(value: unknown): value is AgencyConfig {
  const item = value as Partial<AgencyConfig>;
  return Boolean(
    item &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.shortName === "string" &&
    typeof item.fullName === "string" &&
    typeof item.primaryColor === "string" &&
    typeof item.secondaryColor === "string" &&
    typeof item.badgePrefix === "string" &&
    typeof item.description === "string",
  );
}

function mergeAgencies(defaults: AgencyConfig[], stored: AgencyConfig[]) {
  const merged = new Map<string, AgencyConfig>();
  defaults.forEach((agency) => merged.set(agency.id, { ...agency, isActive: agency.isActive !== false }));
  stored.forEach((agency) => {
    const current = merged.get(agency.id);
    merged.set(agency.id, {
      ...current,
      ...agency,
      isActive: agency.isActive !== false,
    });
  });
  return sortAgencies(Array.from(merged.values()));
}

function sortAgencies(agencies: AgencyConfig[]) {
  return [...agencies].sort((a, b) => {
    if (a.id === "admin") return 1;
    if (b.id === "admin") return -1;
    return 0;
  });
}

async function persistAgencyOverrides(agencies: AgencyConfig[]) {
  // Persist every custom agency, plus any built-in agency that has been edited
  // in any field (so name/colour/logo/description/active edits survive reload).
  const overrides = agencies.filter((agency) => {
    const seed = DEFAULT_AGENCIES.find((item) => item.id === agency.id);
    if (!seed) return true;
    return !agenciesEqual(seed, agency);
  });
  await AsyncStorage.setItem(AGENCY_REGISTRY_KEY, JSON.stringify(overrides));
}

function agenciesEqual(a: AgencyConfig, b: AgencyConfig) {
  return (
    a.name === b.name &&
    a.shortName === b.shortName &&
    a.fullName === b.fullName &&
    a.primaryColor === b.primaryColor &&
    a.secondaryColor === b.secondaryColor &&
    a.badgePrefix === b.badgePrefix &&
    a.description === b.description &&
    a.icon === b.icon &&
    a.isActive === b.isActive
  );
}

function normalizeAgencyId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
