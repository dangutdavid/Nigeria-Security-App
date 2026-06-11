import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type CrimeType =
  | "vehicle_theft"
  | "robbery"
  | "assault"
  | "drug_trafficking"
  | "fraud"
  | "kidnapping"
  | "arson"
  | "cybercrime"
  | "other";

export type CrimeSeverity = "minor" | "moderate" | "serious" | "critical";
export type CrimeStatus = "open" | "investigating" | "arrested" | "closed";

export interface CrimeEvidence {
  id: string;
  uri?: string;
  label: string;
}

export interface Suspect {
  id: string;
  name?: string;
  description: string;
  status: "at_large" | "arrested" | "released";
}

export interface CrimeReport {
  id: string;
  caseNumber: string;
  crimeType: CrimeType;
  severity: CrimeSeverity;
  status: CrimeStatus;
  title: string;
  description: string;
  location: string;
  state: string;
  lga: string;
  latitude?: number;
  longitude?: number;
  plate?: string;
  vehicleDescription?: string;
  suspects: Suspect[];
  evidence: CrimeEvidence[];
  reportedAt: string;
  reportedBy: string;
  reportedByName: string;
  assignedTo?: string;
  assignedToName?: string;
  closedAt?: string;
  notes: string;
}

const CRIME_TYPE_LABELS: Record<CrimeType, string> = {
  vehicle_theft: "Vehicle Theft",
  robbery: "Armed Robbery",
  assault: "Assault & Battery",
  drug_trafficking: "Drug Trafficking",
  fraud: "Fraud / Scam",
  kidnapping: "Kidnapping",
  arson: "Arson",
  cybercrime: "Cybercrime",
  other: "Other",
};

export { CRIME_TYPE_LABELS };

const STORAGE_KEY = "@npf_crime_reports_v1";

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const hrsAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

const SEED_REPORTS: CrimeReport[] = [
  {
    id: "cr-001",
    caseNumber: "NPF/ABJ/2026/001",
    crimeType: "vehicle_theft",
    severity: "serious",
    status: "investigating",
    title: "Toyota Camry stolen at gunpoint",
    description: "Armed men diverted driver and forcibly took silver Toyota Camry at Wuse 2 junction.",
    location: "Wuse 2, Abuja FCT",
    state: "FCT",
    lga: "Abuja Municipal",
    latitude: 9.0735,
    longitude: 7.4892,
    plate: "ABJ 234 KA",
    vehicleDescription: "2019 Silver Toyota Camry",
    suspects: [{ id: "s1", description: "Male, approximately 5'9\", wearing black hoodie", status: "at_large" }],
    evidence: [],
    reportedAt: hrsAgo(6),
    reportedBy: "p1",
    reportedByName: "Insp. Chukwuemeka Okonkwo",
    notes: "",
  },
  {
    id: "cr-002",
    caseNumber: "NPF/LOS/2026/047",
    crimeType: "robbery",
    severity: "critical",
    status: "arrested",
    title: "Armed robbery at Lekki filling station",
    description: "Four suspects robbed filling station staff at gunpoint, making off with approximately ₦2.4m cash.",
    location: "Lekki Phase 1, Lagos",
    state: "Lagos",
    lga: "Eti-Osa",
    latitude: 6.4451,
    longitude: 3.5012,
    suspects: [
      { id: "s2", description: "Male suspect — arrested, in custody", status: "arrested" },
      { id: "s3", description: "Three accomplices — at large", status: "at_large" },
    ],
    evidence: [],
    reportedAt: daysAgo(2),
    reportedBy: "p1",
    reportedByName: "Insp. Chukwuemeka Okonkwo",
    notes: "One suspect arrested at scene. Prosecution underway.",
  },
  {
    id: "cr-003",
    caseNumber: "NPF/KAN/2026/012",
    crimeType: "drug_trafficking",
    severity: "serious",
    status: "open",
    title: "Illicit drug cache found in vehicle",
    description: "Stop-and-search at checkpoint revealed approximately 80kg of suspected cannabis hidden in false floor of commercial vehicle.",
    location: "Kano-Zaria Road, Kano",
    state: "Kano",
    lga: "Fagge",
    plate: "KAN 782 BC",
    vehicleDescription: "2010 Toyota HiAce bus",
    suspects: [{ id: "s4", description: "Vehicle driver — arrested", status: "arrested" }],
    evidence: [],
    reportedAt: daysAgo(1),
    reportedBy: "p2",
    reportedByName: "DSP Aisha Ibrahim",
    notes: "",
  },
  {
    id: "cr-004",
    caseNumber: "NPF/PHC/2026/089",
    crimeType: "fraud",
    severity: "moderate",
    status: "investigating",
    title: "Banking fraud — multiple victims",
    description: "Victims reported unauthorized withdrawals totaling ₦5.8m through BVN compromise.",
    location: "GRA, Port Harcourt",
    state: "Rivers",
    lga: "Port Harcourt",
    suspects: [],
    evidence: [],
    reportedAt: daysAgo(4),
    reportedBy: "p2",
    reportedByName: "DSP Aisha Ibrahim",
    notes: "Coordinating with bank fraud unit.",
  },
  {
    id: "cr-005",
    caseNumber: "NPF/ABJ/2026/003",
    crimeType: "assault",
    severity: "minor",
    status: "closed",
    title: "Road rage assault — Kubwa Expressway",
    description: "Driver assaulted after minor traffic collision. Victim sustained minor bruises.",
    location: "Kubwa Expressway, Abuja",
    state: "FCT",
    lga: "Abuja Municipal",
    suspects: [{ id: "s5", description: "Suspect identified and charged", status: "arrested" }],
    evidence: [],
    reportedAt: daysAgo(7),
    reportedBy: "p1",
    reportedByName: "Insp. Chukwuemeka Okonkwo",
    closedAt: daysAgo(5),
    notes: "Case closed — suspect charged and bound over.",
  },
];

interface CrimeReportContextType {
  reports: CrimeReport[];
  addReport: (r: Omit<CrimeReport, "id" | "caseNumber" | "reportedAt">) => Promise<CrimeReport>;
  updateReport: (id: string, updates: Partial<CrimeReport>) => Promise<void>;
  getReport: (id: string) => CrimeReport | undefined;
}

const CrimeReportContext = createContext<CrimeReportContextType>({
  reports: [],
  addReport: async () => ({} as CrimeReport),
  updateReport: async () => {},
  getReport: () => undefined,
});

export function useCrimeReports() {
  return useContext(CrimeReportContext);
}

function makeCaseNumber(state: string) {
  const abbr = state.slice(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `NPF/${abbr}/${year}/${seq}`;
}

export function CrimeReportProvider({ children }: { children: React.ReactNode }) {
  const [reports, setReports] = useState<CrimeReport[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try {
          const stored: CrimeReport[] = JSON.parse(val);
          const ids = new Set(stored.map((r) => r.id));
          const merged = [...stored, ...SEED_REPORTS.filter((s) => !ids.has(s.id))];
          setReports(merged);
        } catch {
          setReports(SEED_REPORTS);
        }
      } else {
        setReports(SEED_REPORTS);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_REPORTS));
      }
    });
  }, []);

  const addReport = useCallback(async (data: Omit<CrimeReport, "id" | "caseNumber" | "reportedAt">): Promise<CrimeReport> => {
    const report: CrimeReport = {
      ...data,
      id: `cr-${Date.now()}`,
      caseNumber: makeCaseNumber(data.state),
      reportedAt: new Date().toISOString(),
    };
    setReports((prev) => {
      const next = [report, ...prev];
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return report;
  }, []);

  const updateReport = useCallback(async (id: string, updates: Partial<CrimeReport>) => {
    setReports((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...updates } : r));
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getReport = useCallback((id: string) => reports.find((r) => r.id === id), [reports]);

  return (
    <CrimeReportContext.Provider value={{ reports, addReport, updateReport, getReport }}>
      {children}
    </CrimeReportContext.Provider>
  );
}
