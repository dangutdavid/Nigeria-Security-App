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
  draft: { vehicles: [], victims: [] },
  updateDraft: () => {},
  clearDraft: () => {},
});

const STORAGE_KEY = "@frsc_incidents";

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
    description:
      "Head-on collision between articulated truck and passenger bus. Road wet from overnight rain. Truck skidded across central divider.",
    vehicles: [
      {
        id: "v1",
        plate: "ABC-123-FG",
        make: "MAN",
        model: "Articulated Truck",
        colour: "Red",
        type: "truck",
      },
      {
        id: "v2",
        plate: "KJA-456-EK",
        make: "Toyota",
        model: "Hiace Bus",
        colour: "White",
        type: "bus",
      },
    ],
    victims: [
      {
        id: "vt1",
        name: "Unknown",
        age: "~40",
        gender: "male",
        condition: "deceased",
        hospital: "Keffi General Hospital",
      },
      {
        id: "vt2",
        name: "Unknown",
        age: "~25",
        gender: "female",
        condition: "critical",
        hospital: "Keffi General Hospital",
      },
      {
        id: "vt3",
        name: "Unknown",
        age: "~35",
        gender: "male",
        condition: "injured",
        hospital: "Keffi General Hospital",
      },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    assignedTo: "u2",
    assignedToName: "Adaeze Nwosu",
    timeline: [
      {
        id: "t1",
        action: "Incident reported",
        by: "Okafor Emmanuel",
        timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
      {
        id: "t2",
        action: "Assigned to Supervisor Nwosu",
        by: "System",
        timestamp: new Date(Date.now() - 86400000 * 3 + 1800000).toISOString(),
      },
      {
        id: "t3",
        action: "Under review — awaiting hospital reports",
        by: "Adaeze Nwosu",
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: "t4",
        action: "Case closed",
        by: "Adaeze Nwosu",
        timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
      },
    ],
    pendingSync: false,
  },
  {
    id: "INC-2024-002",
    type: "crash",
    severity: "serious",
    status: "under_review",
    title: "Motorcycle collision — Ring Road",
    location: "Ring Road, near Berger Junction",
    lga: "Abuja Municipal",
    state: "FCT",
    latitude: 9.0764,
    longitude: 7.3986,
    dateTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    description:
      "Motorcycle ran red light and was struck by saloon car. Rider sustained head injury.",
    vehicles: [
      {
        id: "v3",
        plate: "FCT-789-GH",
        make: "Honda",
        model: "Bajaj Boxer",
        colour: "Black",
        type: "motorcycle",
      },
      {
        id: "v4",
        plate: "AA-222-KK",
        make: "Toyota",
        model: "Camry",
        colour: "Silver",
        type: "car",
      },
    ],
    victims: [
      {
        id: "vt4",
        name: "Chidi Obi",
        age: "28",
        gender: "male",
        condition: "injured",
        hospital: "National Hospital Abuja",
      },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    assignedTo: "u2",
    assignedToName: "Adaeze Nwosu",
    timeline: [
      {
        id: "t5",
        action: "Incident reported",
        by: "Okafor Emmanuel",
        timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
      },
      {
        id: "t6",
        action: "Assigned to Supervisor Nwosu",
        by: "System",
        timestamp: new Date(
          Date.now() - 86400000 * 1 + 900000
        ).toISOString(),
      },
    ],
    pendingSync: false,
  },
  {
    id: "INC-2024-003",
    type: "breakdown",
    severity: "property_only",
    status: "submitted",
    title: "Stalled tanker — Airport Road",
    location: "Nnamdi Azikiwe Airport Road, km 3",
    lga: "Abuja Municipal",
    state: "FCT",
    latitude: 9.006,
    longitude: 7.263,
    dateTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    description:
      "Fuel tanker stalled blocking right lane. Causing significant tailback.",
    vehicles: [
      {
        id: "v5",
        plate: "ABJ-001-T",
        make: "Mack",
        model: "Fuel Tanker",
        colour: "Yellow",
        type: "truck",
      },
    ],
    victims: [],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      {
        id: "t7",
        action: "Incident reported",
        by: "Okafor Emmanuel",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ],
    pendingSync: false,
  },
  {
    id: "INC-2024-004",
    type: "hazard",
    severity: "serious",
    status: "assigned",
    title: "Pothole hazard — Expressway interchange",
    location: "Mabushi Interchange, Airport-Kubwa Expressway",
    lga: "Abuja Municipal",
    state: "FCT",
    latitude: 9.099,
    longitude: 7.408,
    dateTime: new Date(Date.now() - 3600000 * 5).toISOString(),
    description:
      "Large pothole cluster in fast lane causing vehicles to swerve dangerously. Two near-misses observed.",
    vehicles: [],
    victims: [],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    assignedTo: "u2",
    assignedToName: "Adaeze Nwosu",
    timeline: [
      {
        id: "t8",
        action: "Hazard reported",
        by: "Okafor Emmanuel",
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: "t9",
        action: "Assigned to Supervisor Nwosu for road authority notification",
        by: "System",
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ],
    pendingSync: false,
  },
];

const DEFAULT_DRAFT: DraftReport = { vehicles: [], victims: [] };

export function IncidentProvider({ children }: { children: React.ReactNode }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [draft, setDraft] = useState<DraftReport>(DEFAULT_DRAFT);
  const isOfflineRef = useRef(false);

  useEffect(() => {
    loadIncidents();
    checkNetwork();
    const interval = setInterval(checkNetwork, 7000);
    return () => clearInterval(interval);
  }, []);

  async function checkNetwork() {
    try {
      const state = await Network.getNetworkStateAsync();
      const offline = !state.isConnected || state.isInternetReachable === false;
      isOfflineRef.current = offline;
      setIsOffline(offline);
    } catch {
      // keep previous value
    }
  }

  async function loadIncidents() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setIncidents(JSON.parse(stored));
      } else {
        setIncidents(SEED_INCIDENTS);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_INCIDENTS));
      }
    } catch {
      setIncidents(SEED_INCIDENTS);
    }
  }

  async function saveIncidents(updated: Incident[]) {
    setIncidents(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function addIncident(incident: Incident) {
    const toSave = { ...incident, pendingSync: isOfflineRef.current };
    const updated = [toSave, ...incidents];
    await saveIncidents(updated);
  }

  async function updateIncident(id: string, updates: Partial<Incident>) {
    const updated = incidents.map((inc) =>
      inc.id === id ? { ...inc, ...updates } : inc
    );
    await saveIncidents(updated);
  }

  function getIncident(id: string) {
    return incidents.find((i) => i.id === id);
  }

  async function syncPending() {
    try {
      const state = await Network.getNetworkStateAsync();
      if (!state.isConnected) {
        return;
      }
    } catch {
      return;
    }
    const updated = incidents.map((i) => ({ ...i, pendingSync: false }));
    await saveIncidents(updated);
    isOfflineRef.current = false;
    setIsOffline(false);
  }

  function updateDraft(updates: Partial<DraftReport>) {
    setDraft((prev) => ({ ...prev, ...updates }));
  }

  function clearDraft() {
    setDraft(DEFAULT_DRAFT);
  }

  const pendingCount = incidents.filter((i) => i.pendingSync).length;

  return (
    <IncidentContext.Provider
      value={{
        incidents,
        pendingCount,
        isOffline,
        addIncident,
        updateIncident,
        getIncident,
        syncPending,
        draft,
        updateDraft,
        clearDraft,
      }}
    >
      {children}
    </IncidentContext.Provider>
  );
}

export function useIncidents() {
  return useContext(IncidentContext);
}
