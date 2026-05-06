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

export const PROBABLE_CAUSE_GROUP_LABELS: Record<ProbableCauseCategory, string> = {
  driver: "Driver factors",
  vehicle: "Vehicle factors",
  environment: "Environmental factors",
  temporal: "Temporal factors",
  road: "Road factors",
  other: "Other",
};

export const PROBABLE_CAUSE_LIBRARY: Record<IncidentType, ProbableCause[]> = {
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

export interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  colour: string;
  type: "car" | "truck" | "bus" | "motorcycle" | "other";
}

export interface EvidenceItem {
  id: string;
  uri: string;
  label?: string;
}

export interface Victim {
  id: string;
  name: string;
  age: string;
  gender: "male" | "female" | "unknown";
  condition: "fatal" | "critical" | "injured" | "unhurt";
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
  evidence: EvidenceItem[];
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
  deleteIncident: (id: string) => Promise<void>;
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
  deleteIncident: async () => {},
  getIncident: () => undefined,
  syncPending: async () => {},
  draft: { probableCauses: [], vehicles: [], victims: [] },
  updateDraft: () => {},
  clearDraft: () => {},
});

const STORAGE_KEY = "@frsc_incidents_v2";
const STORAGE_RESET_KEY = "@frsc_incidents_v2_reset";

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
      { id: "vt1", name: "Unknown", age: "~40", gender: "male", condition: "fatal", hospital: "Keffi General Hospital" },
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
  {
    id: "INC-2024-002",
    type: "breakdown",
    severity: "serious",
    status: "submitted",
    title: "Bus breakdown — Airport Road",
    location: "Murtala Muhammed Airport Road",
    lga: "Ikeja",
    state: "Lagos",
    latitude: 6.577,
    longitude: 3.321,
    dateTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    description: "Commercial bus stalled during rush hour, causing heavy traffic buildup.",
    probableCauses: [{ category: "vehicle", code: "BFL", label: "Brake failure" }],
    vehicles: [{ id: "v3", plate: "LAG-201-BR", make: "Mercedes", model: "Sprinter", colour: "Blue", type: "bus" }],
    victims: [],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [{ id: "t3", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 86400000 * 1).toISOString() }],
    pendingSync: false,
  },
  {
    id: "INC-2024-003",
    type: "hazard",
    severity: "minor",
    status: "assigned",
    title: "Fallen cargo on carriageway",
    location: "Otedola Bridge",
    lga: "Mushin",
    state: "Lagos",
    latitude: 6.607,
    longitude: 3.354,
    dateTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    description: "Loose cargo scattered on the road shoulder; scene secured and warning cones placed.",
    probableCauses: [{ category: "environment", code: "ROB", label: "Road obstruction" }],
    vehicles: [],
    victims: [],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    assignedTo: "u1",
    assignedToName: "Okafor Emmanuel",
    timeline: [
      { id: "t4a", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "t4", action: "Assigned to Field Officer Okafor", by: "Adaeze Nwosu", timestamp: new Date(Date.now() - 86400000 * 2 + 1200000).toISOString() },
    ],
    pendingSync: false,
  },
  {
    id: "INC-2024-004",
    type: "flooding",
    severity: "serious",
    status: "assigned",
    title: "Flash flood on expressway",
    location: "Abuja–Kaduna Highway",
    lga: "Bwari",
    state: "FCT",
    latitude: 9.185,
    longitude: 7.145,
    dateTime: new Date(Date.now() - 86400000 * 4).toISOString(),
    description: "Water pooling on carriageway after heavy rain; drainage blocked at roadside culvert.",
    probableCauses: [{ category: "environment", code: "PWR", label: "Poor weather" }],
    vehicles: [],
    victims: [],
    evidence: [],
    reportedBy: "u4",
    reportedByName: "Amina Musa",
    assignedTo: "u1",
    assignedToName: "Okafor Emmanuel",
    timeline: [
      { id: "t5a", action: "Incident reported", by: "Amina Musa", timestamp: new Date(Date.now() - 86400000 * 4).toISOString() },
      { id: "t5", action: "Assigned to Field Officer Okafor", by: "Adaeze Nwosu", timestamp: new Date(Date.now() - 86400000 * 4 + 2400000).toISOString() },
    ],
    pendingSync: false,
  },
  {
    id: "INC-2024-005",
    type: "crash",
    severity: "fatal",
    status: "submitted",
    title: "Truck rollover — Enugu Port Road",
    location: "Enugu Port Road",
    lga: "Enugu East",
    state: "Enugu",
    latitude: 6.448,
    longitude: 7.502,
    dateTime: new Date(Date.now() - 86400000 * 5).toISOString(),
    description: "Overloaded truck lost balance on bend and overturned onto median.",
    probableCauses: [{ category: "vehicle", code: "OVL", label: "Overloading" }],
    vehicles: [{ id: "v4", plate: "ENU-778-TR", make: "Volvo", model: "Trailer", colour: "White", type: "truck" }],
    victims: [{ id: "vt4", name: "Unknown", age: "~46", gender: "male", condition: "fatal" }],
    evidence: [],
    reportedBy: "u2",
    reportedByName: "Adaeze Nwosu",
    timeline: [{ id: "t6", action: "Incident reported", by: "Adaeze Nwosu", timestamp: new Date(Date.now() - 86400000 * 5).toISOString() }],
    pendingSync: false,
  },
  {
    id: "INC-TODAY-001",
    type: "crash",
    severity: "fatal",
    status: "submitted",
    title: "Head-on collision — Kaduna–Zaria Road",
    location: "Km 23, Kaduna–Zaria Expressway",
    lga: "Kaduna North",
    state: "Kaduna",
    latitude: 10.562,
    longitude: 7.438,
    dateTime: new Date(new Date().setHours(7, 30, 0, 0)).toISOString(),
    description: "Two passenger vehicles collided head-on. Scene not yet cleared.",
    probableCauses: [
      { category: "driver", code: "SPD", label: "Speed violation" },
      { category: "environment", code: "BRD", label: "Bad road" },
    ],
    vehicles: [
      { id: "v5", plate: "KD-445-AX", make: "Toyota", model: "Corolla", colour: "Silver", type: "car" },
      { id: "v6", plate: "KD-812-GH", make: "Honda", model: "Accord", colour: "Black", type: "car" },
    ],
    victims: [
      { id: "vt5", name: "Musa Umar", age: "38", gender: "male", condition: "fatal" },
      { id: "vt6", name: "Fatima Yusuf", age: "29", gender: "female", condition: "critical", hospital: "Barau Dikko Teaching Hospital" },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      { id: "td1", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(new Date().setHours(7, 30, 0, 0)).toISOString() },
    ],
    pendingSync: false,
  },
  {
    id: "INC-TODAY-002",
    type: "hazard",
    severity: "minor",
    status: "submitted",
    title: "Debris obstruction — Ring Road",
    location: "Ring Road, near GTB roundabout",
    lga: "Jos North",
    state: "Plateau",
    latitude: 9.917,
    longitude: 8.896,
    dateTime: new Date(new Date().setHours(10, 15, 0, 0)).toISOString(),
    description: "Construction debris scattered across two lanes. Traffic slowing down.",
    probableCauses: [{ category: "environment", code: "ROB", label: "Road obstruction" }],
    vehicles: [],
    victims: [],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      { id: "td2", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(new Date().setHours(10, 15, 0, 0)).toISOString() },
    ],
    pendingSync: false,
  },
];

const DEFAULT_DRAFT: DraftReport = { probableCauses: [], vehicles: [], victims: [] };

export function getProbableCauseLibrary(type: IncidentType) {
  return PROBABLE_CAUSE_LIBRARY[type] ?? [];
}

export function groupProbableCauses(type: IncidentType | null) {
  const library = type ? getProbableCauseLibrary(type) : [];
  return Object.entries(
    library.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<ProbableCauseCategory, ProbableCause[]>)
  ) as Array<[ProbableCauseCategory, ProbableCause[]]>;
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
      const parsed = stored ? (JSON.parse(stored) as Incident[]) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const storedIds = new Set(parsed.map((i) => i.id));
        const newSeedIncs = SEED_INCIDENTS.filter((i) => !storedIds.has(i.id));
        if (newSeedIncs.length > 0) {
          const merged = [...newSeedIncs, ...parsed];
          setIncidents(merged);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } else {
          setIncidents(parsed);
        }
      } else {
        setIncidents(SEED_INCIDENTS);
      }
    } catch {
      setIncidents(SEED_INCIDENTS);
    } finally {
      setPendingCount(0);
    }
  }

  async function persist(next: Incident[]) {
    setIncidents(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    await AsyncStorage.removeItem(STORAGE_RESET_KEY);
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

  async function deleteIncident(id: string) {
    const next = incidents.filter((incident) => incident.id !== id);
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
    <IncidentContext.Provider value={{ incidents, pendingCount, isOffline, addIncident, updateIncident, deleteIncident, getIncident, syncPending, draft, updateDraft, clearDraft }}>
      {children}
    </IncidentContext.Provider>
  );
}

export function useIncidents() {
  return useContext(IncidentContext);
}
