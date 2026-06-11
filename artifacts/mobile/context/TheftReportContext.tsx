import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "@frsc_theft_reports_v1";

export type TheftStage = "new" | "acknowledged" | "investigating";

export type TheftStatusAction =
  | "reported"
  | "acknowledged"
  | "investigating"
  | "recovered"
  | "false_alarm";

export interface TheftStatusEvent {
  at: string;
  action: TheftStatusAction;
  by?: string;
  agency?: string;
  note?: string;
}

export interface TheftReport {
  id: string;
  reference: string;
  plate: string;
  make: string;
  model: string;
  color: string;
  year: string;
  description: string;
  photoUri?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  reportedAt: string;
  reporterName?: string;
  contactPhone?: string;
  status: "active" | "recovered" | "false_alarm";
  stage: TheftStage;
  history: TheftStatusEvent[];
}

export interface NearbyTheftAlert extends TheftReport {
  distanceMiles: number;
  alertRadiusMiles: number;
  minutesElapsed: number;
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getAlertRadiusMiles(reportedAtMs: number): number {
  const min = (Date.now() - reportedAtMs) / 60000;
  if (min < 30) return 2;
  if (min < 120) return 5;
  if (min < 360) return 10;
  return 20;
}

export function formatMinutesAgo(reportedAt: string): string {
  const min = Math.floor(
    (Date.now() - new Date(reportedAt).getTime()) / 60000,
  );
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function refPrefix(year: number): string {
  return `STV-${year}-`;
}

function nextRefForYear(existing: TheftReport[], year: number): string {
  const prefix = refPrefix(year);
  const maxSeq = existing
    .map((r) => r.reference)
    .filter((ref): ref is string => !!ref && ref.startsWith(prefix))
    .map((ref) => parseInt(ref.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

/**
 * Backfills reference / stage / history on reports loaded from older storage
 * formats, ensuring references never collide with existing ones.
 */
function normalizeReports(list: TheftReport[]): TheftReport[] {
  const usedSeq: Record<string, number> = {};
  for (const r of list) {
    if (r.reference) {
      const m = /^STV-(\d{4})-(\d+)$/.exec(r.reference);
      if (m) {
        const prefix = refPrefix(parseInt(m[1], 10));
        usedSeq[prefix] = Math.max(usedSeq[prefix] ?? 0, parseInt(m[2], 10));
      }
    }
  }
  return list.map((r) => {
    let rec = r;
    if (!rec.reference) {
      const year =
        new Date(rec.reportedAt).getFullYear() || new Date().getFullYear();
      const prefix = refPrefix(year);
      const seq = (usedSeq[prefix] ?? 0) + 1;
      usedSeq[prefix] = seq;
      rec = { ...rec, reference: `${prefix}${String(seq).padStart(4, "0")}` };
    }
    if (!rec.stage) rec = { ...rec, stage: "new" };
    if (!rec.history || rec.history.length === 0) {
      rec = {
        ...rec,
        history: [
          { at: rec.reportedAt, action: "reported", by: rec.reporterName },
        ],
      };
    }
    return rec;
  });
}

const SEED_BASE: Omit<TheftReport, "reference" | "stage" | "history">[] = [
  {
    id: "theft-seed-1",
    plate: "AGL 234 KJ",
    make: "Toyota",
    model: "Camry",
    color: "Silver",
    year: "2019",
    description: "Stolen from Allen Avenue car park. Left side mirror cracked.",
    photoUri: undefined,
    location: "Allen Avenue, Ikeja, Lagos",
    latitude: 6.5955,
    longitude: 3.3482,
    reportedAt: new Date(Date.now() - 18 * 60000).toISOString(),
    reporterName: "Chidi Okafor",
    contactPhone: "08031234567",
    status: "active",
  },
  {
    id: "theft-seed-2",
    plate: "KAN 812 AA",
    make: "Honda",
    model: "Accord",
    color: "Black",
    year: "2021",
    description:
      "Carjacked at Sabon Gari junction. Driver threatened with weapon.",
    photoUri: undefined,
    location: "Sabon Gari, Kano",
    latitude: 12.0122,
    longitude: 8.5320,
    reportedAt: new Date(Date.now() - 75 * 60000).toISOString(),
    reporterName: "Amina Bello",
    contactPhone: "08055678901",
    status: "active",
  },
  {
    id: "theft-seed-3",
    plate: "FCT 399 RS",
    make: "Lexus",
    model: "RX 350",
    color: "White",
    year: "2020",
    description: "Stolen overnight from residential area. Tracker disabled.",
    photoUri: undefined,
    location: "Gwarinpa Estate, Abuja",
    latitude: 9.1012,
    longitude: 7.4021,
    reportedAt: new Date(Date.now() - 240 * 60000).toISOString(),
    reporterName: "Emmanuel Adeyemi",
    contactPhone: "07012345678",
    status: "active",
  },
  {
    id: "theft-seed-4",
    plate: "LAG 501 MX",
    make: "Hyundai",
    model: "Tucson",
    color: "Blue",
    year: "2022",
    description: "Vehicle snatched at gunpoint near Lekki toll gate.",
    photoUri: undefined,
    location: "Lekki Toll Gate, Lagos",
    latitude: 6.4441,
    longitude: 3.5312,
    reportedAt: new Date(Date.now() - 22 * 60000).toISOString(),
    reporterName: "Funmi Adeleke",
    contactPhone: "09087654321",
    status: "active",
  },
  {
    id: "theft-seed-5",
    plate: "RIV 177 PH",
    make: "Ford",
    model: "Ranger",
    color: "Red",
    year: "2018",
    description: "Pick-up truck stolen from GRA, Port Harcourt.",
    photoUri: undefined,
    location: "GRA Phase 2, Port Harcourt",
    latitude: 4.8321,
    longitude: 7.0122,
    reportedAt: new Date(Date.now() - 410 * 60000).toISOString(),
    reporterName: "Ngozi Williams",
    contactPhone: "08098765432",
    status: "active",
  },
];

const SEED_STAGES: TheftStage[] = [
  "investigating",
  "acknowledged",
  "new",
  "new",
  "new",
];

const SEED_REPORTS: TheftReport[] = SEED_BASE.map((r, i) => {
  const stage = SEED_STAGES[i] ?? "new";
  const history: TheftStatusEvent[] = [
    { at: r.reportedAt, action: "reported", by: r.reporterName },
  ];
  if (stage === "acknowledged" || stage === "investigating") {
    history.push({ at: r.reportedAt, action: "acknowledged", agency: "police" });
  }
  if (stage === "investigating") {
    history.push({ at: r.reportedAt, action: "investigating", agency: "police" });
  }
  return {
    ...r,
    reference: `STV-2026-${String(i + 1).padStart(4, "0")}`,
    stage,
    history,
  };
});

interface TheftReportContextType {
  reports: TheftReport[];
  nearbyAlerts: NearbyTheftAlert[];
  userLocation: { latitude: number; longitude: number } | null;
  locationPermission: "granted" | "denied" | "undetermined";
  addReport: (
    report: Omit<
      TheftReport,
      "id" | "reportedAt" | "status" | "reference" | "stage" | "history"
    >,
  ) => Promise<TheftReport>;
  updateReportStatus: (
    id: string,
    status: TheftReport["status"],
    by?: string,
    agency?: string,
  ) => Promise<void>;
  advanceStage: (
    id: string,
    stage: Exclude<TheftStage, "new">,
    by?: string,
    agency?: string,
  ) => Promise<void>;
  getReportByReference: (reference: string) => TheftReport | null;
  requestLocationPermission: () => Promise<boolean>;
}

const TheftReportContext = createContext<TheftReportContextType>({
  reports: [],
  nearbyAlerts: [],
  userLocation: null,
  locationPermission: "undetermined",
  addReport: async () => ({} as TheftReport),
  updateReportStatus: async () => {},
  advanceStage: async () => {},
  getReportByReference: () => null,
  requestLocationPermission: async () => false,
});

export function useTheftReports() {
  return useContext(TheftReportContext);
}

export function TheftReportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [reports, setReports] = useState<TheftReport[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState<
    "granted" | "denied" | "undetermined"
  >("undetermined");
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try {
          const stored = JSON.parse(val) as TheftReport[];
          const merged = normalizeReports(mergeWithSeed(stored));
          setReports(merged);
          void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch {
          setReports(SEED_REPORTS);
        }
      } else {
        setReports(SEED_REPORTS);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_REPORTS));
      }
    });

    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status === "granted") {
        setLocationPermission("granted");
        void startWatchingLocation();
      } else if (status === "denied") {
        setLocationPermission("denied");
      }
    });

    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => {
      clearInterval(interval);
      locationSubRef.current?.remove();
    };
  }, []);

  function mergeWithSeed(stored: TheftReport[]): TheftReport[] {
    const storedIds = new Set(stored.map((r) => r.id));
    const seedsToAdd = SEED_REPORTS.filter((s) => !storedIds.has(s.id));
    return [...stored, ...seedsToAdd];
  }

  async function startWatchingLocation() {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      locationSubRef.current?.remove();
      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 100,
          timeInterval: 60000,
        },
        (loc) => {
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        },
      );
    } catch {
    }
  }

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      setLocationPermission("granted");
      await startWatchingLocation();
      return true;
    }
    setLocationPermission("denied");
    return false;
  }, []);

  const nearbyAlerts = React.useMemo<NearbyTheftAlert[]>(() => {
    const activeReports = reports.filter((r) => r.status === "active");
    if (!userLocation) {
      return activeReports.map((r) => {
        const ms = new Date(r.reportedAt).getTime();
        const minElapsed = Math.floor((Date.now() - ms) / 60000);
        return {
          ...r,
          distanceMiles: 0,
          alertRadiusMiles: getAlertRadiusMiles(ms),
          minutesElapsed: minElapsed,
        };
      });
    }

    return activeReports
      .map((r) => {
        const ms = new Date(r.reportedAt).getTime();
        const minElapsed = Math.floor((Date.now() - ms) / 60000);
        const radius = getAlertRadiusMiles(ms);
        const dist =
          r.latitude != null && r.longitude != null
            ? haversineMiles(
                userLocation.latitude,
                userLocation.longitude,
                r.latitude,
                r.longitude,
              )
            : 999;
        return {
          ...r,
          distanceMiles: dist,
          alertRadiusMiles: radius,
          minutesElapsed: minElapsed,
        };
      })
      .filter((r) => r.distanceMiles <= r.alertRadiusMiles)
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [reports, userLocation, tick]);

  const addReport = useCallback(
    async (
      data: Omit<
        TheftReport,
        "id" | "reportedAt" | "status" | "reference" | "stage" | "history"
      >,
    ): Promise<TheftReport> => {
      const nowIso = new Date().toISOString();
      const reference = nextRefForYear(reports, new Date().getFullYear());
      const report: TheftReport = {
        ...data,
        id: `theft-${Date.now()}`,
        reference,
        reportedAt: nowIso,
        status: "active",
        stage: "new",
        history: [
          {
            at: nowIso,
            action: "reported",
            by: data.reporterName || "Citizen",
          },
        ],
      };
      setReports((prev) => {
        const next = [report, ...prev];
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      return report;
    },
    [reports],
  );

  const updateReportStatus = useCallback(
    async (
      id: string,
      status: TheftReport["status"],
      by?: string,
      agency?: string,
    ) => {
      setReports((prev) => {
        const next = prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status,
                history: [
                  ...(r.history ?? []),
                  {
                    at: new Date().toISOString(),
                    action: status,
                    by,
                    agency,
                  } as TheftStatusEvent,
                ],
              }
            : r,
        );
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const advanceStage = useCallback(
    async (
      id: string,
      stage: Exclude<TheftStage, "new">,
      by?: string,
      agency?: string,
    ) => {
      setReports((prev) => {
        const next = prev.map((r) =>
          r.id === id
            ? {
                ...r,
                stage,
                history: [
                  ...(r.history ?? []),
                  {
                    at: new Date().toISOString(),
                    action: stage,
                    by,
                    agency,
                  } as TheftStatusEvent,
                ],
              }
            : r,
        );
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const getReportByReference = useCallback(
    (reference: string): TheftReport | null => {
      const norm = reference.trim().toUpperCase();
      if (!norm) return null;
      return reports.find((r) => r.reference.toUpperCase() === norm) ?? null;
    },
    [reports],
  );

  return (
    <TheftReportContext.Provider
      value={{
        reports,
        nearbyAlerts,
        userLocation,
        locationPermission,
        addReport,
        updateReportStatus,
        advanceStage,
        getReportByReference,
        requestLocationPermission,
      }}
    >
      {children}
    </TheftReportContext.Provider>
  );
}
