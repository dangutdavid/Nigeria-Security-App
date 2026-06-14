import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type InspectionResult = "pass" | "fail" | "conditional";
export type ItemStatus = "pass" | "fail" | "na";
export type VehicleCategory = "private" | "commercial" | "government" | "motorcycle" | "articulated";

export interface InspectionItem {
  id: string;
  category: string;
  item: string;
  status: ItemStatus;
  note?: string;
}

export interface InspectionReport {
  id: string;
  certNumber: string;
  plate: string;
  make: string;
  model: string;
  year: string;
  color: string;
  vehicleCategory: VehicleCategory;
  ownerName: string;
  ownerPhone: string;
  engineNumber: string;
  chassisNumber: string;
  items: InspectionItem[];
  result: InspectionResult;
  certExpiryDate?: string;
  defectNotes: string;
  inspectedAt: string;
  inspectedBy: string;
  inspectedByName: string;
  station: string;
}

export const INSPECTION_CHECKLIST: { category: string; items: string[] }[] = [
  {
    category: "Safety",
    items: ["Seat belts (all seats)", "Fire extinguisher", "First aid kit", "Warning triangle", "Speed limiter (commercial)", "Exhaust emission"],
  },
  {
    category: "Lights & Signals",
    items: ["Headlights", "Tail lights", "Brake lights", "Indicators / turn signals", "Hazard lights", "Reverse lights", "Horn"],
  },
  {
    category: "Mechanical",
    items: ["Brakes (foot)", "Brakes (hand/parking)", "Steering", "Engine condition", "Transmission / gearbox", "Suspension", "Exhaust system"],
  },
  {
    category: "Body & Structure",
    items: ["Windscreen (no cracks)", "Wiper blades", "Mirrors (all)", "Tyres (tread depth)", "Tyres (pressure/condition)", "Wheel nuts", "Body structure / frame"],
  },
  {
    category: "Documentation",
    items: ["Vehicle licence", "Insurance (valid)", "Roadworthiness certificate", "Hackney permit (commercial)", "Driver's licence presented"],
  },
];

const STORAGE_KEY = "@vio_inspections_v1";

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

function makePassItems(): InspectionItem[] {
  return INSPECTION_CHECKLIST.flatMap((cat) =>
    cat.items.map((item, i) => ({
      id: `${cat.category}-${i}`,
      category: cat.category,
      item,
      status: "pass" as ItemStatus,
    }))
  );
}

function makeFailItems(failIdx: number[]): InspectionItem[] {
  let idx = 0;
  return INSPECTION_CHECKLIST.flatMap((cat) =>
    cat.items.map((item, i) => {
      const myIdx = idx++;
      void i;
      return {
        id: `${cat.category}-${myIdx}`,
        category: cat.category,
        item,
        status: failIdx.includes(myIdx) ? ("fail" as ItemStatus) : ("pass" as ItemStatus),
        note: failIdx.includes(myIdx) ? "Requires attention before next use" : undefined,
      };
    })
  );
}

const SEED_INSPECTIONS: InspectionReport[] = [
  {
    id: "ins-001",
    certNumber: "VIO/ABJ/2026/00441",
    plate: "AGL 234 KJ",
    make: "Toyota",
    model: "Camry",
    year: "2019",
    color: "Silver",
    vehicleCategory: "private",
    ownerName: "Chidi Okafor",
    ownerPhone: "08031234567",
    engineNumber: "2AR-FE-12345",
    chassisNumber: "JTNB11HK5J3X12345",
    items: makePassItems(),
    result: "pass",
    certExpiryDate: new Date(now.getTime() + 365 * 86400000).toISOString().split("T")[0],
    defectNotes: "",
    inspectedAt: daysAgo(1),
    inspectedBy: "v1",
    inspectedByName: "Officer Grace Okafor",
    station: "Abuja VIO Centre",
  },
  {
    id: "ins-002",
    certNumber: "VIO/LAG/2026/00892",
    plate: "LAG 501 MX",
    make: "Hyundai",
    model: "Tucson",
    year: "2022",
    color: "Blue",
    vehicleCategory: "private",
    ownerName: "Funmi Adeleke",
    ownerPhone: "09087654321",
    engineNumber: "G4KD-98765",
    chassisNumber: "KMHSH81EP7A098765",
    items: makeFailItems([4, 11]),
    result: "fail",
    defectNotes: "Speed limiter not functioning. Rear left indicator defective.",
    inspectedAt: daysAgo(2),
    inspectedBy: "v1",
    inspectedByName: "Officer Grace Okafor",
    station: "Lagos VIO Office",
  },
  {
    id: "ins-003",
    certNumber: "VIO/KAN/2026/00321",
    plate: "KAN 812 AA",
    make: "Honda",
    model: "Accord",
    year: "2021",
    color: "Black",
    vehicleCategory: "private",
    ownerName: "Amina Bello",
    ownerPhone: "08055678901",
    engineNumber: "K24Z3-45678",
    chassisNumber: "1HGCV1F30LA145678",
    items: makePassItems(),
    result: "pass",
    certExpiryDate: new Date(now.getTime() + 335 * 86400000).toISOString().split("T")[0],
    defectNotes: "",
    inspectedAt: daysAgo(5),
    inspectedBy: "v2",
    inspectedByName: "Sr. Inspector Musa Danjuma",
    station: "Kano VIO Centre",
  },
  {
    id: "ins-004",
    certNumber: "VIO/ABJ/2026/00438",
    plate: "FCT 399 RS",
    make: "Lexus",
    model: "RX 350",
    year: "2020",
    color: "White",
    vehicleCategory: "private",
    ownerName: "Emmanuel Adeyemi",
    ownerPhone: "07012345678",
    engineNumber: "2GR-FSE-77321",
    chassisNumber: "2T2BZMCA4LC123456",
    items: makeFailItems([5, 12, 18]),
    result: "conditional",
    certExpiryDate: new Date(now.getTime() + 90 * 86400000).toISOString().split("T")[0],
    defectNotes: "Exhaust emission slightly above limit. Windscreen minor crack (non-critical). Rear left tyre tread below minimum — replace within 30 days.",
    inspectedAt: daysAgo(3),
    inspectedBy: "v2",
    inspectedByName: "Sr. Inspector Musa Danjuma",
    station: "Abuja VIO Centre",
  },
  {
    id: "ins-005",
    certNumber: "VIO/LOS/2026/00914",
    plate: "KRD 118 XP",
    make: "Toyota",
    model: "Coaster",
    year: "2016",
    color: "White",
    vehicleCategory: "commercial",
    ownerName: "Mainland Transit Ltd",
    ownerPhone: "08022224444",
    engineNumber: "1HZ-55214",
    chassisNumber: "JTGFB518XG0123456",
    items: makeFailItems([3, 8, 15, 19]),
    result: "fail",
    defectNotes: "Warning triangle missing, brake lights faulty, tyre tread below minimum, insurance expired.",
    inspectedAt: daysAgo(0),
    inspectedBy: "v1",
    inspectedByName: "Officer Grace Okafor",
    station: "Lagos VIO Office",
  },
  {
    id: "ins-006",
    certNumber: "VIO/ABJ/2026/00459",
    plate: "ABC 732 LM",
    make: "Toyota",
    model: "Sienna",
    year: "2017",
    color: "Gold",
    vehicleCategory: "commercial",
    ownerName: "Nyanya Shuttle Services",
    ownerPhone: "08123456780",
    engineNumber: "2GR-44590",
    chassisNumber: "5TDZK3DC8HS123456",
    items: makeFailItems([10]),
    result: "conditional",
    certExpiryDate: new Date(now.getTime() + 60 * 86400000).toISOString().split("T")[0],
    defectNotes: "Horn intermittent. Certificate issued conditionally pending repair confirmation.",
    inspectedAt: daysAgo(0),
    inspectedBy: "v1",
    inspectedByName: "Officer Grace Okafor",
    station: "Abuja VIO Centre",
  },
  {
    id: "ins-007",
    certNumber: "VIO/KAN/2026/00344",
    plate: "KNK 204 ZR",
    make: "Nissan",
    model: "Civilian",
    year: "2018",
    color: "Green",
    vehicleCategory: "commercial",
    ownerName: "Kano City Transport",
    ownerPhone: "08033334444",
    engineNumber: "TD42-00981",
    chassisNumber: "JN1TG4E25J0123456",
    items: makePassItems(),
    result: "pass",
    certExpiryDate: new Date(now.getTime() + 365 * 86400000).toISOString().split("T")[0],
    defectNotes: "",
    inspectedAt: daysAgo(1),
    inspectedBy: "v2",
    inspectedByName: "Sr. Inspector Musa Danjuma",
    station: "Kano VIO Centre",
  },
  {
    id: "ins-008",
    certNumber: "VIO/OGU/2026/00112",
    plate: "OGN 402 YK",
    make: "Mack",
    model: "Granite",
    year: "2016",
    color: "White",
    vehicleCategory: "articulated",
    ownerName: "Gateway Logistics",
    ownerPhone: "08070001122",
    engineNumber: "MP8-77122",
    chassisNumber: "1M2AX07C6GM123456",
    items: makeFailItems([5, 16, 17, 20]),
    result: "fail",
    defectNotes: "Brake balance uneven, worn tyres, loose wheel nuts, vehicle licence not current.",
    inspectedAt: daysAgo(4),
    inspectedBy: "v3",
    inspectedByName: "Director Ngozi Eze",
    station: "Ogun VIO Centre",
  },
];

interface InspectionContextType {
  inspections: InspectionReport[];
  addInspection: (r: Omit<InspectionReport, "id" | "certNumber" | "inspectedAt">) => Promise<InspectionReport>;
  updateInspection: (id: string, updates: Partial<InspectionReport>) => Promise<void>;
  getInspection: (id: string) => InspectionReport | undefined;
}

const InspectionContext = createContext<InspectionContextType>({
  inspections: [],
  addInspection: async () => ({} as InspectionReport),
  updateInspection: async () => {},
  getInspection: () => undefined,
});

export function useInspections() {
  return useContext(InspectionContext);
}

function makeCertNumber(station: string) {
  const abbr = station.split(" ")[0].slice(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `VIO/${abbr}/${year}/${seq}`;
}

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const [inspections, setInspections] = useState<InspectionReport[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try {
          const stored: InspectionReport[] = JSON.parse(val);
          const ids = new Set(stored.map((r) => r.id));
          const merged = [...stored, ...SEED_INSPECTIONS.filter((s) => !ids.has(s.id))];
          setInspections(merged);
        } catch {
          setInspections(SEED_INSPECTIONS);
        }
      } else {
        setInspections(SEED_INSPECTIONS);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_INSPECTIONS));
      }
    });
  }, []);

  const addInspection = useCallback(async (data: Omit<InspectionReport, "id" | "certNumber" | "inspectedAt">): Promise<InspectionReport> => {
    const report: InspectionReport = {
      ...data,
      id: `ins-${Date.now()}`,
      certNumber: makeCertNumber(data.station),
      inspectedAt: new Date().toISOString(),
    };
    setInspections((prev) => {
      const next = [report, ...prev];
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return report;
  }, []);

  const updateInspection = useCallback(async (id: string, updates: Partial<InspectionReport>) => {
    setInspections((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...updates } : r));
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getInspection = useCallback((id: string) => inspections.find((r) => r.id === id), [inspections]);

  return (
    <InspectionContext.Provider value={{ inspections, addInspection, updateInspection, getInspection }}>
      {children}
    </InspectionContext.Provider>
  );
}
