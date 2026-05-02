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

const STORAGE_KEY = "@frsc_incidents_v2";

const SEED_INCIDENTS: Incident[] = [
  // ── Plateau State ─────────────────────────────────────────
  {
    id: "INC-2024-010",
    type: "crash",
    severity: "fatal",
    status: "under_review",
    title: "Truck rollover — Bokkos–Mangu Road",
    location: "Km 12, Bokkos–Mangu Federal Road",
    lga: "Bokkos",
    state: "Plateau",
    latitude: 9.287,
    longitude: 9.031,
    dateTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    description: "Articulated truck lost control on steep descent and rolled into a ditch. Three passengers trapped.",
    vehicles: [
      { id: "pv1", plate: "JOS-312-AA", make: "MAN", model: "TGS Truck", colour: "Blue", type: "truck" },
    ],
    victims: [
      { id: "pvt1", name: "Ibrahim Danladi", age: "45", gender: "male", condition: "critical", hospital: "Bokkos Cottage Hospital" },
      { id: "pvt2", name: "Aisha Mohammed", age: "30", gender: "female", condition: "injured", hospital: "Bokkos Cottage Hospital" },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      { id: "pt1", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 86400000).toISOString() },
    ],
    pendingSync: false,
  },
  {
    id: "INC-2024-011",
    type: "crash",
    severity: "serious",
    status: "submitted",
    title: "Head-on collision — Mangu Junction",
    location: "Mangu Town Centre Junction",
    lga: "Mangu",
    state: "Plateau",
    latitude: 9.519,
    longitude: 9.054,
    dateTime: new Date(Date.now() - 3600000 * 4).toISOString(),
    description: "Two buses collided head-on at junction due to failure to observe stop sign. Several passengers injured.",
    vehicles: [
      { id: "pv2", plate: "JOS-445-BB", make: "Toyota", model: "Hiace", colour: "White", type: "bus" },
      { id: "pv3", plate: "KD-221-MN", make: "Hummer", model: "Bus", colour: "Red", type: "bus" },
    ],
    victims: [
      { id: "pvt3", name: "Peter Gyang", age: "38", gender: "male", condition: "injured", hospital: "Mangu General Hospital" },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      { id: "pt2", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 3600000 * 4).toISOString() },
    ],
    pendingSync: false,
  },
  {
    id: "INC-2024-012",
    type: "hazard",
    severity: "serious",
    status: "assigned",
    title: "Road washout — Pankshin–Shendam Road",
    location: "Km 8, Pankshin–Shendam Road",
    lga: "Pankshin",
    state: "Plateau",
    latitude: 9.36,
    longitude: 9.44,
    dateTime: new Date(Date.now() - 3600000 * 10).toISOString(),
    description: "Heavy rainfall caused significant road washout blocking both lanes. Vehicles diverting through farmland.",
    vehicles: [],
    victims: [],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    assignedTo: "u2",
    assignedToName: "Adaeze Nwosu",
    timeline: [
      { id: "pt3", action: "Hazard reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 3600000 * 10).toISOString() },
      { id: "pt4", action: "Assigned for barrier placement", by: "Adaeze Nwosu", timestamp: new Date(Date.now() - 3600000 * 8).toISOString() },
    ],
    pendingSync: false,
  },
  {
    id: "INC-2024-013",
    type: "crash",
    severity: "minor",
    status: "closed",
    title: "Motorcycle fall — Riyom Market",
    location: "Riyom Market Access Road",
    lga: "Riyom",
    state: "Plateau",
    latitude: 9.9,
    longitude: 8.83,
    dateTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    description: "Motorcycle skidded on loose gravel near market entrance. Rider sustained minor abrasions.",
    vehicles: [
      { id: "pv4", plate: "JOS-009-CC", make: "Bajaj", model: "Boxer", colour: "Black", type: "motorcycle" },
    ],
    victims: [
      { id: "pvt4", name: "Sunday Pam", age: "22", gender: "male", condition: "injured", hospital: "Riyom Health Centre" },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      { id: "pt5", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "pt6", action: "Case closed", by: "Adaeze Nwosu", timestamp: new Date(Date.now() - 86400000).toISOString() },
    ],
    pendingSync: false,
  },
  // ── Jos North / Jos South ──────────────────────────────────
  {
    id: "INC-2024-014",
    type: "crash",
    severity: "serious",
    status: "assigned",
    title: "Pedestrian knockdown — Zaria Road",
    location: "Zaria Road, opposite NITEL Building, Jos",
    lga: "Jos North",
    state: "Plateau",
    latitude: 9.917,
    longitude: 8.889,
    dateTime: new Date(Date.now() - 3600000 * 6).toISOString(),
    description: "Pedestrian knocked down by speeding salon car while crossing unmarked pedestrian crossing.",
    vehicles: [
      { id: "pv5", plate: "JOS-555-DD", make: "Honda", model: "Accord", colour: "Black", type: "car" },
    ],
    victims: [
      { id: "pvt5", name: "Grace Dung", age: "55", gender: "female", condition: "critical", hospital: "Jos University Teaching Hospital" },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    assignedTo: "u2",
    assignedToName: "Adaeze Nwosu",
    timeline: [
      { id: "pt7", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 3600000 * 6).toISOString() },
    ],
    pendingSync: false,
  },
  // ── Kaduna ────────────────────────────────────────────────
  {
    id: "INC-2024-020",
    type: "crash",
    severity: "fatal",
    status: "under_review",
    title: "Night collision — Kaduna South Bypass",
    location: "Kaduna South Bypass, Km 4",
    lga: "Kaduna South",
    state: "Kaduna",
    latitude: 10.487,
    longitude: 7.421,
    dateTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    description: "Two vehicles collided in low-visibility conditions. No street lighting on this stretch.",
    vehicles: [
      { id: "kv1", plate: "KD-800-EE", make: "Peugeot", model: "307", colour: "Grey", type: "car" },
      { id: "kv2", plate: "KD-300-FF", make: "Toyota", model: "Land Cruiser", colour: "White", type: "other" },
    ],
    victims: [
      { id: "kvt1", name: "Aminu Bala", age: "42", gender: "male", condition: "deceased", hospital: "Barau Dikko Teaching Hospital" },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      { id: "kt1", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
    ],
    pendingSync: false,
  },
  {
    id: "INC-2024-021",
    type: "breakdown",
    severity: "minor",
    status: "submitted",
    title: "Truck breakdown — Zaria–Kaduna Road",
    location: "Zaria–Kaduna Expressway, Km 22",
    lga: "Zaria",
    state: "Kaduna",
    latitude: 11.08,
    longitude: 7.71,
    dateTime: new Date(Date.now() - 3600000 * 3).toISOString(),
    description: "Articulated truck with brake failure stalled blocking the left lane. Slow-moving traffic for 2km.",
    vehicles: [
      { id: "kv3", plate: "KD-040-GG", make: "DAF", model: "CF Truck", colour: "Red", type: "truck" },
    ],
    victims: [],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      { id: "kt2", action: "Breakdown reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 3600000 * 3).toISOString() },
    ],
    pendingSync: false,
  },
  // ── Kano ──────────────────────────────────────────────────
  {
    id: "INC-2024-030",
    type: "crash",
    severity: "serious",
    status: "submitted",
    title: "Market road pile-up — Kano Municipal",
    location: "Bompai Road, near Sabon Gari Market",
    lga: "Kano Municipal",
    state: "Kano",
    latitude: 12.003,
    longitude: 8.517,
    dateTime: new Date(Date.now() - 3600000 * 8).toISOString(),
    description: "Chain-reaction rear-end collision involving four vehicles at busy market junction during evening rush.",
    vehicles: [
      { id: "knv1", plate: "KN-100-HH", make: "Nissan", model: "Urvan", colour: "Yellow", type: "bus" },
      { id: "knv2", plate: "KN-200-II", make: "Toyota", model: "Corolla", colour: "White", type: "car" },
    ],
    victims: [
      { id: "knvt1", name: "Musa Garba", age: "31", gender: "male", condition: "injured", hospital: "Murtala Muhammed Specialist Hospital" },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      { id: "knt1", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 3600000 * 8).toISOString() },
    ],
    pendingSync: false,
  },
  // ── Rivers ────────────────────────────────────────────────
  {
    id: "INC-2024-040",
    type: "crash",
    severity: "fatal",
    status: "closed",
    title: "Tanker explosion — East–West Road",
    location: "East–West Road, Eleme Junction",
    lga: "Eleme",
    state: "Rivers",
    latitude: 4.791,
    longitude: 7.142,
    dateTime: new Date(Date.now() - 86400000 * 5).toISOString(),
    description: "Fuel tanker overturned and caught fire at busy junction. Multiple vehicles burnt. FRSC, NNPC, and fire service responded.",
    vehicles: [
      { id: "rv1", plate: "PH-888-JJ", make: "Mack", model: "Tanker", colour: "Silver", type: "truck" },
    ],
    victims: [
      { id: "rvt1", name: "Unknown", age: "—", gender: "male", condition: "deceased", hospital: "University of Port Harcourt Teaching Hospital" },
      { id: "rvt2", name: "Unknown", age: "—", gender: "male", condition: "deceased", hospital: "University of Port Harcourt Teaching Hospital" },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      { id: "rt1", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 86400000 * 5).toISOString() },
      { id: "rt2", action: "Case closed after investigation", by: "Adaeze Nwosu", timestamp: new Date(Date.now() - 86400000 * 3).toISOString() },
    ],
    pendingSync: false,
  },
  // ── Lagos ─────────────────────────────────────────────────
  {
    id: "INC-2024-050",
    type: "crash",
    severity: "serious",
    status: "under_review",
    title: "Okada collision — Lagos Mainland",
    location: "Ikorodu Road, near Maryland",
    lga: "Lagos Mainland",
    state: "Lagos",
    latitude: 6.572,
    longitude: 3.361,
    dateTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    description: "Commercial motorcycle cut across three lanes and collided with a BRT bus. Rider and pillion passenger injured.",
    vehicles: [
      { id: "lv1", plate: "LSD-445-KK", make: "Honda", model: "CB125", colour: "Yellow", type: "motorcycle" },
      { id: "lv2", plate: "LSD-BRT-22", make: "Ashok Leyland", model: "BRT Bus", colour: "Blue", type: "bus" },
    ],
    victims: [
      { id: "lvt1", name: "Tunde Oladele", age: "26", gender: "male", condition: "injured", hospital: "Lagos Island General Hospital" },
    ],
    evidence: [],
    reportedBy: "u1",
    reportedByName: "Okafor Emmanuel",
    timeline: [
      { id: "lt1", action: "Incident reported", by: "Okafor Emmanuel", timestamp: new Date(Date.now() - 86400000).toISOString() },
    ],
    pendingSync: false,
  },
  // ── Nasarawa ──────────────────────────────────────────────
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
