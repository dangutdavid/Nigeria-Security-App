import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type AgencyId = "frsc" | "police" | "vio" | string;

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

export const AGENCIES: AgencyConfig[] = [
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
];

const STORAGE_KEY = "@frsc_selected_agency";

interface AgencyContextType {
  selectedAgency: AgencyConfig | null;
  selectAgency: (id: AgencyId) => Promise<void>;
  clearAgency: () => Promise<void>;
  getAgencyById: (id: AgencyId) => AgencyConfig | undefined;
}

const AgencyContext = createContext<AgencyContextType>({
  selectedAgency: null,
  selectAgency: async () => {},
  clearAgency: async () => {},
  getAgencyById: () => undefined,
});

export function useAgency() {
  return useContext(AgencyContext);
}

export function AgencyProvider({ children }: { children: React.ReactNode }) {
  const [selectedAgency, setSelectedAgency] = useState<AgencyConfig | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        const agency = AGENCIES.find((a) => a.id === val);
        if (agency) setSelectedAgency(agency);
      }
    });
  }, []);

  const selectAgency = useCallback(async (id: AgencyId) => {
    const agency = AGENCIES.find((a) => a.id === id) ?? null;
    setSelectedAgency(agency);
    if (agency) await AsyncStorage.setItem(STORAGE_KEY, id);
  }, []);

  const clearAgency = useCallback(async () => {
    setSelectedAgency(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const getAgencyById = useCallback((id: AgencyId) => AGENCIES.find((a) => a.id === id), []);

  return (
    <AgencyContext.Provider value={{ selectedAgency, selectAgency, clearAgency, getAgencyById }}>
      {children}
    </AgencyContext.Provider>
  );
}
