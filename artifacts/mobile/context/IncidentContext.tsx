import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export type IncidentType = "crash" | "breakdown" | "hazard" | "flooding";
export type SeverityLevel = "fatal" | "serious" | "minor" | "property_only";
export type IncidentStatus =
  | "draft"
  | "submitted"
  | "assigned"
  | "under_review"
  | "closed";

export type ProbableCauseCategory =
  | "driver"
  | "vehicle"
  | "environment"
  | "temporal"
  | "road"
  | "other";

export interface ProbableCause {
  category: ProbableCauseCategory;
  code: string;
  label: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  colour: string;
  type: "car" | "truck" | "bus" | "motorcycle" | "other";
}

export interface Victim {
  id: string;
  name: string;
  age: string;
  gender: "male" | "female" | "unknown";
  condition: "deceased" | "critical" | "injured" | "unhurt";
  hospital?: string;
}

export interface TimelineEntry {
  id: string;
  action: string;
  by: string;
  timestamp: string;
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: SeverityLevel;
  status: IncidentStatus;
  title: string;
  location: string;
  lga: string;
  state: string;
  latitude: number;
  longitude: number;
  dateTime: string;
  description: string;
  probableCauses: ProbableCause[];
  vehicles: Vehicle[];
  victims: Victim[];
  evidence: string[];
  reportedBy: string;
  reportedByName: string;
  assignedTo?: string;
  assignedToName?: string;
  timeline: TimelineEntry[];
  pendingSync: boolean;
}

export interface DraftReport {
  type?: IncidentType;
  severity?: SeverityLevel;
  location?: string;
  lga?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  probableCauses: ProbableCause[];
  vehicles: Vehicle[];
  victims: Victim[];
  notes?: string;
}

interface IncidentContextType {
  incidents: Incident[];
  pendingCount: number;
  isOffline: boolean;
  addIncident: (incident: Incident) => Promise<void>;
  updateIncident: (id: string, updates: Partial<Incident>) => Promise<void>;
  getIncident: (id: string) => Incident | undefined;
  syncPending: () => Promise<void>;
  draft: DraftReport;
  updateDraft: (updates: Partial<DraftReport>) => void;
  clearDraft: () => void;
}

const IncidentContext = createContext<IncidentContextType>({
  incidents: [],
  pendingCount: 0,
  isOffline: false,
  addIncident: async () => {},
  updateIncident: async () => {},
  getIncident: () => undefined,
  syncPending: async () => {},
  draft: { probableCauses: [], vehicles: [], victims: [] },
  updateDraft: () => {},
  clearDraft: () => {},
});

const STORAGE_KEY = "@frsc_incidents_v2";

const SEED_INCIDENTS: Incident[] = [
  {
    id: "INC-2024-001",
    type: "crash",
    severity: "fatal",
    status: "closed",
    title: "Multi-vehicle collision — A1 Highway",
    location: "Km 47, Abuja–Keffi Expressway",
    lga: "Keffi",
    state: "Nasarawa",
    latitude: 8.848,
    longitude: 7.873,
    dateTime: new Date(Date.now() - 86400000 * 3).toISOString(),
    description: "Head-on collision between articulated truck and passenger bus. Road wet from overnight rain.",
    probableCauses: [
      { category: "road", code: "RTV", label: "Route violation" },
      { category: "environment", code: "BRD", label: "Bad road" },
    ],
    vehicles: [
      { id: "v1", plate: "ABC-123-FG", make: "MAN", model: "Articulated Truck", colour: "Red", type: "truck" },
      { id: "v2", plate: "KJA-456-EK", make: "Toyota", model: "Hiace Bus", colour: "White", type: "bus" },
    ],
    victims: [
      { id: "vt1", name: "Unknown", age: "~40", gender: "male", condition: "deceased", hospital: "Keffi General Hospital" },
      { id: "vt2", name: "Unknown", age: "~25", gender: "female", condition: "critical", hospital: "Keffi General Hospital" },
      { id: "vt3", name: "Unknown", age: "~35", gender: "male", condition: "injured", hospital: "Keffi General Hospital" },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    assignedTo: "u2",
    assignedToName: "Adaeze Nwosu",
    timeline: [
      { id: "t1", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: "t2", action: "Assigned to Supervisor Nwosu", by: "System", timestamp: new Date(Date.now() - 86400000 * 3 + 1800000).toISOString() },
    ],
    pendingSync: false,
  },
];

const DEFAULT_DRAFT: DraftReport = { probableCauses: [], vehicles: [], victims: [] };

const PROBABLE_CAUSE_LIBRARY: Record<IncidentType, ProbableCause[]> = {
  crash: [
    { category: "driver", code: "DUI", label: "Alcohol / drug use" },
    { category: "driver", code: "LOC", label: "Loss of control" },
    { category: "driver", code: "SLV", label: "Signal light violation" },
    { category: "driver", code: "FTQ", label: "Fatigue driving" },
    { category: "driver", code: "DD", label: "Driver distraction" },
    { category: "driver", code: "SOS", label: "Sleeping on steering" },
    { category: "driver", code: "SPV", label: "Speed violation" },
    { category: "driver", code: "DGD", label: "Dangerous overtaking" },
    { category: "driver", code: "WOV", label: "Wrongful overtaking" },
    { category: "driver", code: "UPD", label: "Phone use while driving" },
    { category: "driver", code: "RTV", label: "Route violation" },
    { category: "driver", code: "CSV", label: "Caution sign violation" },
    { category: "driver", code: "UDR", label: "Underage driving / riding" },
    { category: "vehicle", code: "TBT", label: "Tyre burst" },
    { category: "vehicle", code: "BFL", label: "Brake failure" },
    { category: "vehicle", code: "OVL", label: "Overloading" },
    { category: "vehicle", code: "MDV", label: "Mechanically deficient vehicle" },
    { category: "vehicle", code: "EWT", label: "Worn expired tyre" },
    { category: "environment", code: "BRD", label: "Bad road" },
    { category: "environment", code: "PWR", label: "Poor weather" },
    { category: "environment", code: "ROB", label: "Road obstruction" },
    { category: "temporal", code: "Season", label: "Seasonal factor" },
    { category: "temporal", code: "BusiesMonth", label: "Busiest month / travel period" },
    { category: "temporal", code: "Weekday", label: "Weekday factor" },
    { category: "temporal", code: "Peak", label: "Peak hour" },
    { category: "temporal", code: "Night", label: "Night time factor" },
  ],
  breakdown: [
    { category: "vehicle", code: "BFL", label: "Brake failure" },
    { category: "vehicle", code: "MDV", label: "Mechanically deficient vehicle" },
    { category: "vehicle", code: "EWT", label: "Worn expired tyre" },
    { category: "vehicle", code: "OVL", label: "Overloading" },
    { category: "environment", code: "ROB", label: "Road obstruction" },
  ],
  hazard: [
    { category: "environment", code: "BRD", label: "Bad road" },
    { category: "environment", code: "PWR", label: "Poor weather" },
    { category: "environment", code: "ROB", label: "Road obstruction" },
  ],
  flooding: [
    { category: "environment", code: "PWR", label: "Poor weather" },
    { category: "environment", code: "ROB", label: "Road obstruction" },
  ],
};

export const PROBABLE_CAUSES = PROBABLE_CAUSE_LIBRARY;

export function getProbableCauseLibrary(type: IncidentType) {
  return PROBABLE_CAUSE_LIBRARY[type] ?? [];
}

export function isProbableCauseCategory(value: string): value is ProbableCauseCategory {
  return ["driver", "vehicle", "environment", "temporal", "road", "other"].includes(value);
}

export function IncidentProvider({ children }: { children: React.ReactNode }) {
  const [incidents, setIncidents] = useState<Incident[]>(SEED_INCIDENTS);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [draft, setDraft] = useState<DraftReport>(DEFAULT_DRAFT);
  const syncTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    load();
    void Network.getNetworkStateAsync().then((state) => setIsOffline(!state.isConnected));
    syncTimer.current = setInterval(async () => {
      const state = await Network.getNetworkStateAsync();
      setIsOffline(!state.isConnected);
    }, 15000);
    return () => {
      if (syncTimer.current) clearInterval(syncTimer.current);
    };
  }, []);

  async function load() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setIncidents(JSON.parse(stored));
    } catch {
    } finally {
      setPendingCount(0);
    }
  }

  async function persist(next: Incident[]) {
    setIncidents(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPendingCount(next.filter((i) => i.pendingSync).length);
  }

  async function addIncident(incident: Incident) {
    const next = [
      { ...incident, pendingSync: isOffline || incident.pendingSync, probableCauses: incident.probableCauses ?? [] },
      ...incidents,
    ];
    await persist(next);
  }

  async function updateIncident(id: string, updates: Partial<Incident>) {
    const next = incidents.map((incident) => (incident.id === id ? { ...incident, ...updates } : incident));
    await persist(next);
  }

  function getIncident(id: string) {
    return incidents.find((incident) => incident.id === id);
  }

  async function syncPending() {
    const next = incidents.map((incident) => (incident.pendingSync ? { ...incident, pendingSync: false } : incident));
    await persist(next);
    setIsOffline(false);
  }

  function updateDraft(updates: Partial<DraftReport>) {
    setDraft((current) => ({
      ...current,
      ...updates,
      probableCauses: updates.probableCauses ?? current.probableCauses,
      vehicles: updates.vehicles ?? current.vehicles,
      victims: updates.victims ?? current.victims,
    }));
  }

  function clearDraft() {
    setDraft(DEFAULT_DRAFT);
  }

  return (
    <IncidentContext.Provider value={{ incidents, pendingCount, isOffline, addIncident, updateIncident, getIncident, syncPending, draft, updateDraft, clearDraft }}>
      {children}
    </IncidentContext.Provider>
  );
}

export function useIncidents() {
  return useContext(IncidentContext);
}
