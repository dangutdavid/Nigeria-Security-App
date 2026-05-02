export type VehicleCategory = "private" | "commercial" | "government" | "motorcycle";
export type VehicleStatus = "valid" | "expired" | "suspended" | "stolen";

export interface VehicleRecord {
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  category: VehicleCategory;
  engineNo: string;
  chassisNo: string;
  owner: {
    name: string;
    address: string;
    phone: string;
    licenseNo: string;
    licenseExpiry: string;
  };
  registration: {
    status: VehicleStatus;
    expiry: string;
    state: string;
    lga: string;
  };
  insurance: {
    company: string;
    policyNo: string;
    expiry: string;
    status: VehicleStatus;
  };
  roadworthiness: {
    status: VehicleStatus;
    expiry: string;
    lastInspected: string;
    station: string;
  };
  flags: string[];
}

export const VEHICLE_DB: VehicleRecord[] = [
  {
    plate: "AGL 234 KJ",
    make: "Toyota",
    model: "Camry",
    year: 2019,
    color: "Silver",
    category: "private",
    engineNo: "2AR-1948372",
    chassisNo: "JTDBE32K493012847",
    owner: {
      name: "Chukwuemeka Obi",
      address: "14 Adeola Odeku Street, Victoria Island, Lagos",
      phone: "+234 803 456 7890",
      licenseNo: "LGS-DL-2019-004512",
      licenseExpiry: "2026-08-15",
    },
    registration: { status: "valid", expiry: "2025-12-31", state: "Lagos", lga: "Eti-Osa" },
    insurance: { company: "AIICO Insurance", policyNo: "AI-2024-0034512", expiry: "2025-06-30", status: "valid" },
    roadworthiness: { status: "valid", expiry: "2025-09-15", lastInspected: "2024-09-15", station: "Surulere FRSC" },
    flags: [],
  },
  {
    plate: "ABJ 007 FSC",
    make: "Toyota",
    model: "Land Cruiser",
    year: 2022,
    color: "White",
    category: "government",
    engineNo: "1VD-FTV-002291",
    chassisNo: "JTMHV05J584062918",
    owner: {
      name: "Federal Road Safety Corps",
      address: "FRSC Headquarters, Wuse Zone 5, Abuja",
      phone: "+234 9 523 7000",
      licenseNo: "GOVT-FLEET-2022",
      licenseExpiry: "2030-01-01",
    },
    registration: { status: "valid", expiry: "2026-03-31", state: "FCT", lga: "Abuja Municipal" },
    insurance: { company: "NICON Insurance", policyNo: "NI-GOV-2024-0001", expiry: "2026-03-31", status: "valid" },
    roadworthiness: { status: "valid", expiry: "2026-03-31", lastInspected: "2025-03-20", station: "Abuja Command HQ" },
    flags: [],
  },
  {
    plate: "KAN 812 AA",
    make: "Honda",
    model: "Accord",
    year: 2016,
    color: "Black",
    category: "private",
    engineNo: "K24Z9-83741029",
    chassisNo: "1HGCR2F53GA223410",
    owner: {
      name: "Musa Abdullahi",
      address: "22 Murtala Mohammed Way, Kano",
      phone: "+234 807 234 5678",
      licenseNo: "KAN-DL-2018-019283",
      licenseExpiry: "2024-11-20",
    },
    registration: { status: "expired", expiry: "2024-03-31", state: "Kano", lga: "Kano Municipal" },
    insurance: { company: "Leadway Assurance", policyNo: "LA-2023-1928372", expiry: "2024-02-28", status: "expired" },
    roadworthiness: { status: "expired", expiry: "2023-12-31", lastInspected: "2022-12-10", station: "Kano North FRSC" },
    flags: ["EXPIRED REGISTRATION", "EXPIRED INSURANCE", "OVERDUE INSPECTION"],
  },
  {
    plate: "OYO 441 BX",
    make: "Nissan",
    model: "Almera",
    year: 2014,
    color: "Red",
    category: "private",
    engineNo: "HR16DE-4412872",
    chassisNo: "JN1TBNT32U0029401",
    owner: {
      name: "Adebayo Tunde",
      address: "5 Agodi Gate Road, Ibadan",
      phone: "+234 815 678 9012",
      licenseNo: "OYO-DL-2020-003847",
      licenseExpiry: "2025-04-10",
    },
    registration: { status: "valid", expiry: "2025-09-30", state: "Oyo", lga: "Ibadan North" },
    insurance: { company: "AXA Mansard", policyNo: "AX-2024-0098321", expiry: "2025-09-30", status: "valid" },
    roadworthiness: { status: "valid", expiry: "2025-06-15", lastInspected: "2024-06-15", station: "Ibadan Central FRSC" },
    flags: [],
  },
  {
    plate: "RVS 091 GH",
    make: "Mitsubishi",
    model: "L200",
    year: 2018,
    color: "Blue",
    category: "commercial",
    engineNo: "4D56-UTT-009281",
    chassisNo: "MMBKJHG26GH001928",
    owner: {
      name: "Rivers Transport Ltd",
      address: "12 Trans-Amadi Industrial Layout, Port Harcourt",
      phone: "+234 818 000 4567",
      licenseNo: "RVS-COM-2018-00291",
      licenseExpiry: "2025-07-01",
    },
    registration: { status: "valid", expiry: "2025-11-30", state: "Rivers", lga: "Port Harcourt" },
    insurance: { company: "Consolidated Hallmark", policyNo: "CH-2024-0019283", expiry: "2025-11-30", status: "valid" },
    roadworthiness: { status: "valid", expiry: "2025-07-01", lastInspected: "2024-07-01", station: "Trans-Amadi FRSC" },
    flags: [],
  },
  {
    plate: "ENU 339 CD",
    make: "Toyota",
    model: "Hilux",
    year: 2020,
    color: "White",
    category: "commercial",
    engineNo: "2GD-FTV-118374",
    chassisNo: "MR0EX32G901023847",
    owner: {
      name: "Okeke Building Supplies",
      address: "Old Market Road, Enugu",
      phone: "+234 803 900 1234",
      licenseNo: "ENU-COM-2020-00481",
      licenseExpiry: "2026-01-15",
    },
    registration: { status: "valid", expiry: "2025-12-31", state: "Enugu", lga: "Enugu North" },
    insurance: { company: "NEM Insurance", policyNo: "NEM-2024-0038271", expiry: "2025-08-31", status: "valid" },
    roadworthiness: { status: "valid", expiry: "2025-10-20", lastInspected: "2024-10-20", station: "Enugu FRSC Command" },
    flags: [],
  },
  {
    plate: "LAG 501 MX",
    make: "Volkswagen",
    model: "Passat",
    year: 2017,
    color: "Grey",
    category: "private",
    engineNo: "CDA-1092837",
    chassisNo: "WVWZZZ3CZHE192831",
    owner: {
      name: "Folake Adeyemi",
      address: "8 Bode Thomas Street, Surulere, Lagos",
      phone: "+234 812 345 6789",
      licenseNo: "LGS-DL-2017-028374",
      licenseExpiry: "2023-10-05",
    },
    registration: { status: "valid", expiry: "2025-06-30", state: "Lagos", lga: "Surulere" },
    insurance: { company: "AIICO Insurance", policyNo: "AI-2024-0071293", expiry: "2025-06-30", status: "valid" },
    roadworthiness: { status: "suspended", expiry: "2023-11-30", lastInspected: "2022-11-30", station: "Surulere FRSC" },
    flags: ["SUSPENDED ROADWORTHINESS", "EXPIRED DRIVER LICENSE"],
  },
  {
    plate: "ABK 227 ZX",
    make: "Bajaj",
    model: "Boxer BM 100",
    year: 2021,
    color: "Red/Black",
    category: "motorcycle",
    engineNo: "BAJBM-921029384",
    chassisNo: "MD2A08EZ5LCJ19283",
    owner: {
      name: "Emeka Chukwu",
      address: "Okpanam Road, Asaba, Delta State",
      phone: "+234 806 543 2109",
      licenseNo: "DLT-DL-2021-009284",
      licenseExpiry: "2026-05-20",
    },
    registration: { status: "valid", expiry: "2025-05-31", state: "Delta", lga: "Oshimili North" },
    insurance: { company: "Mutual Benefits", policyNo: "MB-2024-0029184", expiry: "2025-05-31", status: "valid" },
    roadworthiness: { status: "valid", expiry: "2025-05-31", lastInspected: "2024-05-31", station: "Asaba FRSC" },
    flags: [],
  },
  {
    plate: "KAD 098 RA",
    make: "Ford",
    model: "Transit",
    year: 2015,
    color: "Yellow",
    category: "commercial",
    engineNo: "DURATORQ-T5-009182",
    chassisNo: "WF0XXXTTGXFR19284",
    owner: {
      name: "North Road Transport Cooperative",
      address: "Transport House, Kaduna",
      phone: "+234 800 290 1234",
      licenseNo: "KAD-COM-2015-00192",
      licenseExpiry: "2025-11-30",
    },
    registration: { status: "valid", expiry: "2025-10-31", state: "Kaduna", lga: "Kaduna North" },
    insurance: { company: "Cornerstone Insurance", policyNo: "CI-2024-0018372", expiry: "2025-10-31", status: "valid" },
    roadworthiness: { status: "valid", expiry: "2025-04-30", lastInspected: "2024-04-30", station: "Kaduna Command" },
    flags: [],
  },
  {
    plate: "OSU 773 PQ",
    make: "Mercedes-Benz",
    model: "E350",
    year: 2021,
    color: "Black",
    category: "private",
    engineNo: "OM656-7781029",
    chassisNo: "WDD2130751A019283",
    owner: {
      name: "Chief Emeka Okonkwo",
      address: "Plot 14, GRA Phase 2, Onitsha, Anambra",
      phone: "+234 802 871 0000",
      licenseNo: "ANM-DL-2019-001829",
      licenseExpiry: "2026-09-10",
    },
    registration: { status: "valid", expiry: "2026-02-28", state: "Anambra", lga: "Onitsha North" },
    insurance: { company: "AIICO Insurance", policyNo: "AI-2025-0001029", expiry: "2026-02-28", status: "valid" },
    roadworthiness: { status: "valid", expiry: "2026-01-31", lastInspected: "2025-01-31", station: "Onitsha FRSC" },
    flags: [],
  },
  {
    plate: "BEN 412 HH",
    make: "Toyota",
    model: "Sienna",
    year: 2013,
    color: "Gold",
    category: "private",
    engineNo: "2GR-FE-8872039",
    chassisNo: "5TDYK3DC3DS302918",
    owner: {
      name: "Ngozi Eze",
      address: "Liberation Road, Benin City",
      phone: "+234 814 290 8765",
      licenseNo: "EDO-DL-2020-004182",
      licenseExpiry: "2025-02-28",
    },
    registration: { status: "expired", expiry: "2024-08-31", state: "Edo", lga: "Oredo" },
    insurance: { company: "Leadway Assurance", policyNo: "LA-2023-0091827", expiry: "2024-09-30", status: "expired" },
    roadworthiness: { status: "valid", expiry: "2025-03-31", lastInspected: "2024-03-31", station: "Benin FRSC" },
    flags: ["EXPIRED REGISTRATION", "EXPIRED INSURANCE"],
  },
  {
    plate: "IMO 662 BB",
    make: "Suzuki",
    model: "Jimny",
    year: 2022,
    color: "Green",
    category: "private",
    engineNo: "K15B-002938472",
    chassisNo: "JSAFJB43V00291837",
    owner: {
      name: "Amarachi Onwuegbusi",
      address: "New Owerri, Imo State",
      phone: "+234 805 112 9900",
      licenseNo: "IMO-DL-2022-007391",
      licenseExpiry: "2027-06-01",
    },
    registration: { status: "valid", expiry: "2026-06-30", state: "Imo", lga: "Owerri Municipal" },
    insurance: { company: "NEM Insurance", policyNo: "NEM-2024-0047382", expiry: "2026-06-30", status: "valid" },
    roadworthiness: { status: "valid", expiry: "2026-03-20", lastInspected: "2025-03-20", station: "Owerri FRSC" },
    flags: [],
  },
  {
    plate: "FCT 399 RS",
    make: "Toyota",
    model: "Corolla",
    year: 2018,
    color: "White",
    category: "private",
    engineNo: "2ZR-FE-119284",
    chassisNo: "JTDBU4EE6AJ019283",
    owner: {
      name: "STOLEN VEHICLE",
      address: "Report Filed — Abuja Area Command",
      phone: "N/A",
      licenseNo: "N/A",
      licenseExpiry: "N/A",
    },
    registration: { status: "stolen", expiry: "2025-12-31", state: "FCT", lga: "Bwari" },
    insurance: { company: "Veritas Glanvills", policyNo: "VG-2024-0019283", expiry: "2025-12-31", status: "suspended" },
    roadworthiness: { status: "suspended", expiry: "N/A", lastInspected: "2024-01-10", station: "Kubwa FRSC" },
    flags: ["⚠️ STOLEN VEHICLE — REPORT IMMEDIATELY", "DO NOT RELEASE"],
  },
  {
    plate: "SOK 220 YY",
    make: "Peugeot",
    model: "307",
    year: 2010,
    color: "Blue",
    category: "private",
    engineNo: "TU5JP4-8812039",
    chassisNo: "VF33C9HXB81019284",
    owner: {
      name: "Ibrahim Aliyu",
      address: "Sultan Abubakar Road, Sokoto",
      phone: "+234 806 781 2345",
      licenseNo: "SKT-DL-2016-002391",
      licenseExpiry: "2022-04-15",
    },
    registration: { status: "expired", expiry: "2022-12-31", state: "Sokoto", lga: "Sokoto North" },
    insurance: { company: "Prestige Assurance", policyNo: "PA-2021-0028374", expiry: "2022-12-31", status: "expired" },
    roadworthiness: { status: "expired", expiry: "2022-06-30", lastInspected: "2021-06-30", station: "Sokoto FRSC" },
    flags: ["EXPIRED REGISTRATION", "EXPIRED INSURANCE", "EXPIRED ROADWORTHINESS", "EXPIRED DRIVER LICENSE"],
  },
  {
    plate: "NAS 101 FC",
    make: "Land Rover",
    model: "Defender 110",
    year: 2023,
    color: "White",
    category: "government",
    engineNo: "P400-MHEV-002918",
    chassisNo: "SALLDWHE5PH019283",
    owner: {
      name: "Nasarawa State Government",
      address: "Government House, Lafia",
      phone: "+234 47 222 5000",
      licenseNo: "GOVT-NAS-2023-00001",
      licenseExpiry: "2030-01-01",
    },
    registration: { status: "valid", expiry: "2026-12-31", state: "Nasarawa", lga: "Lafia" },
    insurance: { company: "NICON Insurance", policyNo: "NI-GOV-NAS-2023", expiry: "2026-12-31", status: "valid" },
    roadworthiness: { status: "valid", expiry: "2026-12-31", lastInspected: "2025-01-15", station: "Lafia FRSC" },
    flags: [],
  },
];

export function lookupVehicle(plate: string): VehicleRecord | null {
  const normalized = plate.replace(/\s+/g, " ").trim().toUpperCase();
  return (
    VEHICLE_DB.find(
      (v) => v.plate.replace(/\s+/g, " ").trim().toUpperCase() === normalized
    ) ?? null
  );
}
