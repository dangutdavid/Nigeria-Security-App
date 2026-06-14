import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AgencyType } from "@/context/AuthContext";
import { normalizePlate } from "@/lib/plate";

/**
 * Cross-agency referral layer (explicit sharing model).
 *
 * Agencies do NOT see each other's records by default. Collaboration happens
 * through explicit referrals: an officer "refers" a single record to another
 * agency, sending a lightweight snapshot plus a thread of notes. This mirrors
 * real inter-agency protocol and keeps each agency's data store private.
 *
 * Backend-shaped: this is a single shared collection keyed by from/to agency.
 * When migrated to a server it becomes a `referrals` table with row-level
 * visibility (a user sees rows where to_agency = their agency, or from_agency
 * = their agency for the outbox).
 */

const STORAGE_KEY = "@shared_referrals_v1";

export type ReferralRecordType = "incident" | "crime_report" | "inspection" | "theft_report";
export type ReferralStatus = "pending" | "acknowledged" | "actioned" | "closed";

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: "Pending",
  acknowledged: "Acknowledged",
  actioned: "Actioned",
  closed: "Closed",
};

export interface ReferralSnapshot {
  title: string;
  plate?: string;
  severity?: string;
  location?: string;
  summary?: string;
}

export interface ReferralNote {
  id: string;
  text: string;
  authorName: string;
  agency: AgencyType;
  createdAt: string;
}

export interface Referral {
  id: string;
  fromAgency: AgencyType;
  toAgency: AgencyType;
  recordType: ReferralRecordType;
  recordId: string;
  snapshot: ReferralSnapshot;
  status: ReferralStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  notes: ReferralNote[];
}

const hrsAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

const SEED_REFERRALS: Referral[] = [
  {
    id: "ref-seed-1",
    fromAgency: "vio",
    toAgency: "police",
    recordType: "inspection",
    recordId: "ins-002",
    snapshot: {
      title: "Failed inspection — Hyundai Tucson",
      plate: "LAG 501 MX",
      severity: "fail",
      location: "Lagos VIO Office",
      summary:
        "Vehicle failed roadworthiness (speed limiter & indicator defects). Plate also matches an active stolen-vehicle report — escalating to Police.",
    },
    status: "pending",
    createdBy: "v2",
    createdByName: "Sr. Inspector Musa Danjuma",
    createdAt: hrsAgo(3),
    notes: [
      {
        id: "rn-seed-1",
        text: "Owner could not produce valid documents. Recommend stop-and-detain if seen on road.",
        authorName: "Sr. Inspector Musa Danjuma",
        agency: "vio",
        createdAt: hrsAgo(3),
      },
    ],
  },
  {
    id: "ref-seed-2",
    fromAgency: "police",
    toAgency: "frsc",
    recordType: "crime_report",
    recordId: "cr-003",
    snapshot: {
      title: "Illicit drug cache in commercial vehicle",
      plate: "KAN 782 BC",
      severity: "serious",
      location: "Kano-Zaria Road, Kano",
      summary:
        "Commercial vehicle flagged at checkpoint. Requesting FRSC coordination on the Kano-Zaria corridor for related commercial traffic.",
    },
    status: "acknowledged",
    createdBy: "p2",
    createdByName: "DSP Aisha Ibrahim",
    createdAt: hrsAgo(20),
    notes: [],
  },
  {
    id: "ref-seed-3",
    fromAgency: "police",
    toAgency: "vio",
    recordType: "crime_report",
    recordId: "cr-001",
    snapshot: {
      title: "Stolen vehicle — flag on inspection",
      plate: "ABJ 234 KA",
      severity: "serious",
      location: "Wuse 2, Abuja FCT",
      summary:
        "Silver Toyota Camry taken at gunpoint. If presented for inspection or certificate renewal, detain and notify NPF immediately.",
    },
    status: "pending",
    createdBy: "p1",
    createdByName: "Insp. Chukwuemeka Okonkwo",
    createdAt: hrsAgo(8),
    notes: [],
  },
  {
    id: "ref-seed-4",
    fromAgency: "police",
    toAgency: "civil_defence",
    recordType: "crime_report",
    recordId: "CIR-NSC002",
    snapshot: {
      title: "Crowd control support requested",
      severity: "high",
      location: "Ahmadu Bello Way near Secretariat Junction, Kaduna",
      summary:
        "Police patrol dispersed initial protest activity. Requesting NSCDC support around public infrastructure and crowd monitoring.",
    },
    status: "pending",
    createdBy: "p2",
    createdByName: "DSP Aisha Ibrahim",
    createdAt: hrsAgo(5),
    notes: [
      {
        id: "rn-seed-4",
        text: "No active assault reported, but the crowd is reforming around government property.",
        authorName: "DSP Aisha Ibrahim",
        agency: "police",
        createdAt: hrsAgo(5),
      },
    ],
  },
  {
    id: "ref-seed-5",
    fromAgency: "frsc",
    toAgency: "civil_defence",
    recordType: "incident",
    recordId: "CIR-NSC001",
    snapshot: {
      title: "Fire risk near market access road",
      plate: "LND 442 XA",
      severity: "critical",
      location: "Mile 12 Market access road, Kosofe, Lagos",
      summary:
        "FRSC unit reports traffic obstruction around a smoke/fire scene. NSCDC rescue coordination requested for crowd control and scene safety.",
    },
    status: "acknowledged",
    createdBy: "f1",
    createdByName: "Marshal Adewale Johnson",
    createdAt: hrsAgo(2),
    notes: [],
  },
  {
    id: "ref-seed-6",
    fromAgency: "civil_defence",
    toAgency: "frsc",
    recordType: "incident",
    recordId: "CIR-NSC004",
    snapshot: {
      title: "Flooding affecting traffic corridor",
      severity: "medium",
      location: "Zoo Road, Kano Municipal, Kano",
      summary:
        "NSCDC flood response team requests FRSC traffic diversion support while evacuation assessment continues.",
    },
    status: "actioned",
    createdBy: "n2",
    createdByName: "Superintendent Ibrahim Musa",
    createdAt: hrsAgo(16),
    notes: [
      {
        id: "rn-seed-6",
        text: "Traffic build-up is affecting access for rescue vehicles.",
        authorName: "Superintendent Ibrahim Musa",
        agency: "civil_defence",
        createdAt: hrsAgo(16),
      },
    ],
  },
  {
    id: "ref-seed-7",
    fromAgency: "vio",
    toAgency: "frsc",
    recordType: "inspection",
    recordId: "ins-005",
    snapshot: {
      title: "Failed commercial bus inspection",
      plate: "KRD 118 XP",
      severity: "fail",
      location: "Lagos VIO Office",
      summary:
        "Commercial bus failed safety inspection with brake-light and tyre defects. FRSC patrol support requested on Jibowu corridor.",
    },
    status: "pending",
    createdBy: "v1",
    createdByName: "Officer Grace Okafor",
    createdAt: hrsAgo(1),
    notes: [],
  },
  {
    id: "ref-seed-8",
    fromAgency: "frsc",
    toAgency: "police",
    recordType: "incident",
    recordId: "INC-TODAY-003",
    snapshot: {
      title: "Suspicious abandoned truck at port access",
      plate: "APP-441-TR",
      severity: "property_only",
      location: "Apapa-Oshodi Expressway",
      summary:
        "Truck breakdown is causing obstruction, but driver left scene before FRSC arrival. Police identity check requested.",
    },
    status: "pending",
    createdBy: "u1",
    createdByName: "Okafor Emmanuel",
    createdAt: hrsAgo(2),
    notes: [],
  },
  {
    id: "ref-seed-9",
    fromAgency: "civil_defence",
    toAgency: "police",
    recordType: "incident",
    recordId: "CIR-NSC007",
    snapshot: {
      title: "Civil emergency with crowd control risk",
      severity: "critical",
      location: "Barnawa, Kaduna South, Kaduna",
      summary:
        "NSCDC responders are managing a partial building collapse. Police support requested for access control and crowd dispersal.",
    },
    status: "acknowledged",
    createdBy: "c2",
    createdByName: "ASC Halima Yusuf",
    createdAt: hrsAgo(9),
    notes: [
      {
        id: "rn-seed-9",
        text: "Crowd is blocking emergency vehicle access on the narrow approach road.",
        authorName: "ASC Halima Yusuf",
        agency: "civil_defence",
        createdAt: hrsAgo(9),
      },
    ],
  },
];

interface AddReferralInput {
  fromAgency: AgencyType;
  toAgency: AgencyType;
  recordType: ReferralRecordType;
  recordId: string;
  snapshot: ReferralSnapshot;
  createdBy: string;
  createdByName: string;
  initialNote?: string;
}

interface ReferralContextType {
  referrals: Referral[];
  addReferral: (input: AddReferralInput) => Promise<Referral>;
  updateReferralStatus: (id: string, status: ReferralStatus) => Promise<void>;
  addReferralNote: (id: string, text: string, authorName: string, agency: AgencyType) => Promise<void>;
  getReferral: (id: string) => Referral | undefined;
  inboxFor: (agency: AgencyType) => Referral[];
  outboxFor: (agency: AgencyType) => Referral[];
  pendingCountFor: (agency: AgencyType) => number;
  referralsForRecord: (recordType: ReferralRecordType, recordId: string) => Referral[];
  openReferralsByPlate: (plate: string) => Referral[];
}

const ReferralContext = createContext<ReferralContextType>({
  referrals: [],
  addReferral: async () => ({} as Referral),
  updateReferralStatus: async () => {},
  addReferralNote: async () => {},
  getReferral: () => undefined,
  inboxFor: () => [],
  outboxFor: () => [],
  pendingCountFor: () => 0,
  referralsForRecord: () => [],
  openReferralsByPlate: () => [],
});

export function useReferrals() {
  return useContext(ReferralContext);
}

export function ReferralProvider({ children }: { children: React.ReactNode }) {
  const [referrals, setReferrals] = useState<Referral[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try {
          const stored: Referral[] = JSON.parse(val);
          const ids = new Set(stored.map((r) => r.id));
          setReferrals([...stored, ...SEED_REFERRALS.filter((s) => !ids.has(s.id))]);
        } catch {
          setReferrals(SEED_REFERRALS);
        }
      } else {
        setReferrals(SEED_REFERRALS);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_REFERRALS));
      }
    });
  }, []);

  const persist = useCallback((next: Referral[]) => {
    setReferrals(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addReferral = useCallback(
    async (input: AddReferralInput): Promise<Referral> => {
      const createdAt = new Date().toISOString();
      const referral: Referral = {
        id: `ref-${Date.now()}`,
        fromAgency: input.fromAgency,
        toAgency: input.toAgency,
        recordType: input.recordType,
        recordId: input.recordId,
        snapshot: input.snapshot,
        status: "pending",
        createdBy: input.createdBy,
        createdByName: input.createdByName,
        createdAt,
        notes: input.initialNote?.trim()
          ? [
              {
                id: `rn-${Date.now()}`,
                text: input.initialNote.trim(),
                authorName: input.createdByName,
                agency: input.fromAgency,
                createdAt,
              },
            ]
          : [],
      };
      setReferrals((prev) => {
        const next = [referral, ...prev];
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      return referral;
    },
    []
  );

  const updateReferralStatus = useCallback(
    async (id: string, status: ReferralStatus) => {
      setReferrals((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, status } : r));
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const addReferralNote = useCallback(
    async (id: string, text: string, authorName: string, agency: AgencyType) => {
      if (!text.trim()) return;
      setReferrals((prev) => {
        const next = prev.map((r) =>
          r.id === id
            ? {
                ...r,
                notes: [
                  ...r.notes,
                  {
                    id: `rn-${Date.now()}`,
                    text: text.trim(),
                    authorName,
                    agency,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : r
        );
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const getReferral = useCallback((id: string) => referrals.find((r) => r.id === id), [referrals]);

  const inboxFor = useCallback(
    (agency: AgencyType) =>
      referrals
        .filter((r) => r.toAgency === agency)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [referrals]
  );

  const outboxFor = useCallback(
    (agency: AgencyType) =>
      referrals
        .filter((r) => r.fromAgency === agency)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [referrals]
  );

  const pendingCountFor = useCallback(
    (agency: AgencyType) => referrals.filter((r) => r.toAgency === agency && r.status === "pending").length,
    [referrals]
  );

  const referralsForRecord = useCallback(
    (recordType: ReferralRecordType, recordId: string) =>
      referrals.filter((r) => r.recordType === recordType && r.recordId === recordId),
    [referrals]
  );

  const openReferralsByPlate = useCallback(
    (plate: string) => {
      if (!plate?.trim()) return [];
      const target = normalizePlate(plate);
      return referrals.filter(
        (r) =>
          r.status !== "closed" &&
          r.snapshot.plate &&
          normalizePlate(r.snapshot.plate) === target
      );
    },
    [referrals]
  );

  const value = useMemo<ReferralContextType>(
    () => ({
      referrals,
      addReferral,
      updateReferralStatus,
      addReferralNote,
      getReferral,
      inboxFor,
      outboxFor,
      pendingCountFor,
      referralsForRecord,
      openReferralsByPlate,
    }),
    [
      referrals,
      addReferral,
      updateReferralStatus,
      addReferralNote,
      getReferral,
      inboxFor,
      outboxFor,
      pendingCountFor,
      referralsForRecord,
      openReferralsByPlate,
    ]
  );

  return <ReferralContext.Provider value={value}>{children}</ReferralContext.Provider>;
}
