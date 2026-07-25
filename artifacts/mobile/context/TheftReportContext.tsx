import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { submitCitizenReport } from "@/services/reportRepository";
import { uploadReportPhoto } from "@/services/evidenceRepository";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "@frsc_theft_reports_v1";

export interface TheftReport {
  id: string;
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
  /** Backend citizen-report reference when the theft was submitted via API. */
  citizenReportReference?: string;
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

const SEED_REPORTS: TheftReport[] = [
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
  {
    id: "theft-seed-6",
    plate: "ABC 732 LM",
    make: "Toyota",
    model: "Sienna",
    color: "Gold",
    year: "2017",
    description: "Vehicle taken from church premises during evening service.",
    photoUri: undefined,
    location: "Nyanya, Abuja",
    latitude: 9.0267,
    longitude: 7.5753,
    reportedAt: new Date(Date.now() - 9 * 60000).toISOString(),
    reporterName: "Maryam Hassan",
    contactPhone: "08123456780",
    status: "active",
  },
  {
    id: "theft-seed-7",
    plate: "OGN 402 YK",
    make: "Mack",
    model: "Granite",
    color: "White",
    year: "2016",
    description: "Truck removed from depot without authorization. Cargo container still attached.",
    photoUri: undefined,
    location: "Sango Ota, Ogun",
    latitude: 6.6905,
    longitude: 3.2342,
    reportedAt: new Date(Date.now() - 155 * 60000).toISOString(),
    reporterName: "Depot Security",
    contactPhone: "08070001122",
    status: "active",
  },
  {
    id: "theft-seed-8",
    plate: "ENU 219 KC",
    make: "Mercedes-Benz",
    model: "C300",
    color: "Grey",
    year: "2021",
    description: "Recovered after roadside stop. Owner notified.",
    photoUri: undefined,
    location: "Independence Layout, Enugu",
    latitude: 6.4413,
    longitude: 7.4988,
    reportedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    reporterName: "Ikenna Nwafor",
    contactPhone: "08045556789",
    status: "recovered",
  },
];

interface TheftReportContextType {
  reports: TheftReport[];
  nearbyAlerts: NearbyTheftAlert[];
  userLocation: { latitude: number; longitude: number } | null;
  locationPermission: "granted" | "denied" | "undetermined";
  addReport: (
    report: Omit<TheftReport, "id" | "reportedAt" | "status">,
  ) => Promise<TheftReport>;
  updateReportStatus: (
    id: string,
    status: TheftReport["status"],
  ) => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
}

const TheftReportContext = createContext<TheftReportContextType>({
  reports: [],
  nearbyAlerts: [],
  userLocation: null,
  locationPermission: "undetermined",
  addReport: async () => ({} as TheftReport),
  updateReportStatus: async () => {},
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
          const merged = mergeWithSeed(stored);
          setReports(merged);
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
      data: Omit<TheftReport, "id" | "reportedAt" | "status">,
    ): Promise<TheftReport> => {
      // API-first: file the theft with the police via the citizen-report
      // pipeline so it lands in the backend. The local record below stays as
      // the cache that powers offline viewing and nearby-alert radius maths.
      let citizenReportReference: string | undefined;
      try {
        const vehicle = [data.year, data.color, data.make, data.model]
          .filter(Boolean)
          .join(" ");
        // Idempotency key + proof-of-submitter for the evidence upload below.
        const clientId = `theft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const receipt = await submitCitizenReport({
          clientId,
          incidentType: "vehicle_theft",
          description: `Stolen vehicle: ${vehicle} (${data.plate}). ${data.description}`.trim(),
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.location,
          locationSource: data.latitude != null ? "gps" : "manual",
          photoUri: data.photoUri,
          vehicleRegistration: data.plate,
          emergencyLevel: "high",
          suggestedAgency: "police",
        });
        citizenReportReference = receipt.reference;
        if (data.photoUri) void uploadReportPhoto(receipt.reference, data.photoUri, clientId);
      } catch {
        // Submission falls back to local-only; the record is still saved.
      }

      const report: TheftReport = {
        ...data,
        id: `theft-${Date.now()}`,
        reportedAt: new Date().toISOString(),
        status: "active",
        citizenReportReference,
      };
      setReports((prev) => {
        const next = [report, ...prev];
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      return report;
    },
    [],
  );

  const updateReportStatus = useCallback(
    async (id: string, status: TheftReport["status"]) => {
      setReports((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, status } : r));
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
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
        requestLocationPermission,
      }}
    >
      {children}
    </TheftReportContext.Provider>
  );
}
