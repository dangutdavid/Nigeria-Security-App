import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AgencyType } from "@/context/AuthContext";
import { createAuditEvent } from "@/services/auditLogService";

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
}

export type NewAgencyInput = Omit<AgencyConfig, "id" | "tabRoute"> & {
  id?: string;
};

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
}

const AgencyContext = createContext<AgencyContextType>({
  agencies: DEFAULT_AGENCIES,
  selectedAgency: null,
  selectAgency: async () => {},
  clearAgency: async () => {},
  getAgencyById: () => undefined,
  addAgency: async () => DEFAULT_AGENCIES[0],
});

export function useAgency() {
  return useContext(AgencyContext);
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
      const merged = mergeAgencies(DEFAULT_AGENCIES, storedAgencies);
      setAgencies(merged);
      if (selected) {
        const agency = merged.find((a) => a.id === selected);
        if (agency) setSelectedAgency(agency);
      }
    }

    void load();
  }, []);

  const selectAgency = useCallback(async (id: AgencyId) => {
    const agency = agencies.find((a) => a.id === id) ?? null;
    setSelectedAgency(agency);
    if (agency) await AsyncStorage.setItem(STORAGE_KEY, id);
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
      tabRoute: "/unauthorized",
    };

    const next = [...agencies, agency];
    setAgencies(next);
    const customAgencies = next.filter((item) => !DEFAULT_AGENCIES.some((seed) => seed.id === item.id));
    await AsyncStorage.setItem(AGENCY_REGISTRY_KEY, JSON.stringify(customAgencies));
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

  return (
    <AgencyContext.Provider value={{ agencies, selectedAgency, selectAgency, clearAgency, getAgencyById, addAgency }}>
      {children}
    </AgencyContext.Provider>
  );
}

function parseStoredAgencies(raw: string | null): AgencyConfig[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAgencyConfig) : [];
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
  const seen = new Set<string>();
  return [...defaults, ...stored].filter((agency) => {
    if (seen.has(agency.id)) return false;
    seen.add(agency.id);
    return true;
  });
}

function normalizeAgencyId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
