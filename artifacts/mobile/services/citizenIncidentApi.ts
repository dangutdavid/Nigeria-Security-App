import AsyncStorage from "@react-native-async-storage/async-storage";

import { createAuditEvent } from "@/services/auditLogService";
import { createNotification, priorityFromEmergency } from "@/services/notificationService";

export type CitizenIncidentType =
  | "road_crash"
  | "traffic_obstruction"
  | "dangerous_driving"
  | "vehicle_breakdown"
  | "road_hazard"
  | "vehicle_theft"
  | "theft"
  | "robbery"
  | "assault"
  | "missing_vehicle_alert"
  | "security_incident"
  | "crime"
  | "fire_rescue"
  | "disaster_response"
  | "public_threat"
  | "crowd_control"
  | "infrastructure_risk"
  | "suspicious_activity"
  | "civil_emergency"
  | "community_safety"
  | "security_support_referral"
  | "vehicle_issue"
  | "roadworthiness_complaint"
  | "dangerous_vehicle"
  | "vehicle_inspection_concern"
  | "invalid_certificate_concern"
  | "commercial_vehicle_safety_issue"
  | "vehicle_documentation_concern"
  | "medical"
  | "other";

export type CitizenEmergencyLevel = "low" | "medium" | "high" | "critical";
export type CitizenAgencyRoute = "frsc" | "police" | "vio" | "civil_defence";
export type CitizenLocationSource = "gps" | "manual";
export type CitizenIncidentStatus =
  | "submitted"
  | "triaged"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed";

export interface CitizenIncidentSubmission {
  incidentType: CitizenIncidentType;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  state?: string;
  lga?: string;
  locationSource?: CitizenLocationSource;
  accuracy?: number;
  photoUri?: string;
  vehicleRegistration?: string;
  emergencyLevel: CitizenEmergencyLevel;
  suggestedAgency: CitizenAgencyRoute;
}

export interface CitizenIncidentTimelineEntry {
  id: string;
  action: string;
  by: string;
  timestamp: string;
}

export interface CitizenIncidentReceipt extends CitizenIncidentSubmission {
  id: string;
  reference: string;
  status: CitizenIncidentStatus;
  submittedAt: string;
  timeline?: CitizenIncidentTimelineEntry[];
}

const STORAGE_KEY = "@citizen_incident_reports_v1";

const now = Date.now();
const hoursAgo = (hours: number) => new Date(now - hours * 3600000).toISOString();

function seedTimeline(
  reference: string,
  entries: Array<{ action: string; by: string; hoursAgo: number }>,
): CitizenIncidentTimelineEntry[] {
  return entries.map((entry, index) => ({
    id: `${reference.toLowerCase()}-tl-${index + 1}`,
    action: entry.action,
    by: entry.by,
    timestamp: hoursAgo(entry.hoursAgo),
  }));
}

const SEED_CITIZEN_REPORTS: CitizenIncidentReceipt[] = [
  {
    id: "seed-citizen-nscdc-001",
    reference: "CIR-NSC001",
    incidentType: "fire_rescue",
    description: "Smoke and visible flames reported behind a market storage block. Traders are moving goods out while nearby residents gather.",
    location: "Mile 12 Market access road, Kosofe, Lagos",
    latitude: 6.6022,
    longitude: 3.3978,
    vehicleRegistration: "LND 442 XA",
    emergencyLevel: "critical",
    suggestedAgency: "civil_defence",
    status: "submitted",
    submittedAt: hoursAgo(2),
    timeline: seedTimeline("CIR-NSC001", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 2 },
    ]),
  },
  {
    id: "seed-citizen-nscdc-002",
    reference: "CIR-NSC002",
    incidentType: "public_threat",
    description: "Large crowd forming around a damaged public facility after a protest dispersed. Caller reports tension but no injuries yet.",
    location: "Ahmadu Bello Way near Secretariat Junction, Kaduna",
    latitude: 10.5264,
    longitude: 7.4388,
    emergencyLevel: "high",
    suggestedAgency: "civil_defence",
    status: "triaged",
    submittedAt: hoursAgo(7),
    timeline: seedTimeline("CIR-NSC002", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 7 },
      { action: "NSCDC marked report Triaged", by: "Officer Binta Sani", hoursAgo: 6 },
    ]),
  },
  {
    id: "seed-citizen-nscdc-003",
    reference: "CIR-NSC003",
    incidentType: "infrastructure_risk",
    description: "Electric pole leaning over a busy roadside after heavy rain. Sparks were seen near exposed cables.",
    location: "Aba Road by Waterlines, Port Harcourt, Rivers",
    latitude: 4.8156,
    longitude: 7.0498,
    emergencyLevel: "high",
    suggestedAgency: "civil_defence",
    status: "assigned",
    submittedAt: hoursAgo(15),
    timeline: seedTimeline("CIR-NSC003", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 15 },
      { action: "NSCDC marked report Triaged", by: "Officer Binta Sani", hoursAgo: 14 },
      { action: "NSCDC marked report Assigned", by: "Superintendent Ibrahim Musa", hoursAgo: 13 },
    ]),
  },
  {
    id: "seed-citizen-nscdc-004",
    reference: "CIR-NSC004",
    incidentType: "disaster_response",
    description: "Flood water entering homes after blocked drainage overflowed. Residents request evacuation support for elderly occupants.",
    location: "Zoo Road, Kano Municipal, Kano",
    latitude: 12.0061,
    longitude: 8.5317,
    emergencyLevel: "medium",
    suggestedAgency: "civil_defence",
    status: "in_progress",
    submittedAt: hoursAgo(22),
    timeline: seedTimeline("CIR-NSC004", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 22 },
      { action: "NSCDC marked report Triaged", by: "Officer Binta Sani", hoursAgo: 21 },
      { action: "NSCDC marked report Assigned", by: "Superintendent Ibrahim Musa", hoursAgo: 19 },
      { action: "NSCDC marked report In Progress", by: "Officer Binta Sani", hoursAgo: 17 },
    ]),
  },
  {
    id: "seed-citizen-frsc-001",
    reference: "CIR-FRS001",
    incidentType: "road_crash",
    description: "Two vehicles involved in a collision near a busy junction. Traffic is building and one passenger appears injured.",
    location: "Airport Road by Lugbe Junction, Abuja FCT",
    latitude: 9.0119,
    longitude: 7.3927,
    vehicleRegistration: "ABC 219 QR",
    emergencyLevel: "critical",
    suggestedAgency: "frsc",
    status: "assigned",
    submittedAt: hoursAgo(4),
    timeline: seedTimeline("CIR-FRS001", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 4 },
      { action: "FRSC marked report Triaged", by: "Marshal Adewale Johnson", hoursAgo: 3 },
      { action: "FRSC marked report Assigned", by: "SRC Fatima Bello", hoursAgo: 2 },
    ]),
  },
  {
    id: "seed-citizen-police-001",
    reference: "CIR-POL001",
    incidentType: "crime",
    description: "Caller reports a robbery attempt near a bus stop. Suspects fled toward a side street.",
    location: "Wuse 2, Abuja FCT",
    latitude: 9.082,
    longitude: 7.4709,
    emergencyLevel: "high",
    suggestedAgency: "police",
    status: "in_progress",
    submittedAt: hoursAgo(9),
    timeline: seedTimeline("CIR-POL001", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 9 },
      { action: "Police marked report Triaged", by: "Insp. Chukwuemeka Okonkwo", hoursAgo: 8 },
      { action: "Police marked report In Progress", by: "DSP Aisha Ibrahim", hoursAgo: 6 },
    ]),
  },
  {
    id: "seed-citizen-police-002",
    reference: "CIR-POL002",
    incidentType: "vehicle_theft",
    description: "Resident reports a white Toyota Corolla stolen from a parking area overnight. Vehicle was last seen heading toward the expressway.",
    location: "GRA Phase 1, Port Harcourt, Rivers",
    latitude: 4.8242,
    longitude: 7.0336,
    vehicleRegistration: "RBC 815 AL",
    emergencyLevel: "high",
    suggestedAgency: "police",
    status: "submitted",
    submittedAt: hoursAgo(3),
    timeline: seedTimeline("CIR-POL002", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 3 },
    ]),
  },
  {
    id: "seed-citizen-police-003",
    reference: "CIR-POL003",
    incidentType: "suspicious_activity",
    description: "Caller reports repeated suspicious movement around a closed warehouse after midnight.",
    location: "Onitsha Industrial Layout, Anambra",
    latitude: 6.1413,
    longitude: 6.7866,
    emergencyLevel: "medium",
    suggestedAgency: "police",
    status: "triaged",
    submittedAt: hoursAgo(18),
    timeline: seedTimeline("CIR-POL003", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 18 },
      { action: "Police marked report Triaged", by: "Insp. Chukwuemeka Okonkwo", hoursAgo: 17 },
    ]),
  },
  {
    id: "seed-citizen-vio-001",
    reference: "CIR-VIO001",
    incidentType: "vehicle_issue",
    description: "Commercial bus with visible smoke and broken rear lights continues carrying passengers.",
    location: "Ikeja Along Bus Stop, Lagos",
    latitude: 6.5965,
    longitude: 3.3421,
    vehicleRegistration: "KJA 771 BT",
    emergencyLevel: "medium",
    suggestedAgency: "vio",
    status: "resolved",
    submittedAt: hoursAgo(28),
    timeline: seedTimeline("CIR-VIO001", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 28 },
      { action: "VIO marked report Triaged", by: "Officer Grace Okafor", hoursAgo: 27 },
      { action: "VIO marked report Resolved", by: "Sr. Inspector Musa Danjuma", hoursAgo: 24 },
    ]),
  },
  {
    id: "seed-citizen-vio-002",
    reference: "CIR-VIO002",
    incidentType: "roadworthiness_complaint",
    description: "Heavy truck has missing brake lights and appears overloaded while operating near a school route.",
    location: "Abeokuta Road by Sango Ota, Ogun",
    latitude: 6.6905,
    longitude: 3.2342,
    vehicleRegistration: "OGN 402 YK",
    emergencyLevel: "high",
    suggestedAgency: "vio",
    status: "submitted",
    submittedAt: hoursAgo(6),
    timeline: seedTimeline("CIR-VIO002", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 6 },
    ]),
  },
  {
    id: "seed-citizen-vio-003",
    reference: "CIR-VIO003",
    incidentType: "invalid_certificate_concern",
    description: "Citizen suspects a commercial bus is displaying an altered roadworthiness certificate.",
    location: "Nyanya Motor Park, Abuja FCT",
    latitude: 9.0267,
    longitude: 7.5753,
    vehicleRegistration: "ABC 732 LM",
    emergencyLevel: "medium",
    suggestedAgency: "vio",
    status: "assigned",
    submittedAt: hoursAgo(13),
    timeline: seedTimeline("CIR-VIO003", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 13 },
      { action: "VIO marked report Triaged", by: "Officer Grace Okafor", hoursAgo: 12 },
      { action: "VIO marked report Assigned", by: "Sr. Inspector Musa Danjuma", hoursAgo: 11 },
    ]),
  },
  {
    id: "seed-citizen-nscdc-005",
    reference: "CIR-NSC005",
    incidentType: "community_safety",
    description: "Community volunteers report repeated nighttime vandalism around a public water facility.",
    location: "GRA Phase 2, Enugu",
    latitude: 6.4578,
    longitude: 7.5464,
    emergencyLevel: "low",
    suggestedAgency: "civil_defence",
    status: "closed",
    submittedAt: hoursAgo(52),
    timeline: seedTimeline("CIR-NSC005", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 52 },
      { action: "NSCDC marked report Triaged", by: "Officer Binta Sani", hoursAgo: 50 },
      { action: "NSCDC marked report Resolved", by: "Superintendent Ibrahim Musa", hoursAgo: 42 },
      { action: "NSCDC marked report Closed", by: "Commandant Aisha Bello", hoursAgo: 36 },
    ]),
  },
  {
    id: "seed-citizen-frsc-002",
    reference: "CIR-FRS002",
    incidentType: "traffic_obstruction",
    description: "Broken-down fuel tanker blocking two lanes. Drivers are attempting unsafe U-turns around the scene.",
    location: "Third Mainland Bridge inward Iyana-Oworo, Lagos",
    latitude: 6.5079,
    longitude: 3.4038,
    vehicleRegistration: "EKY 540 TR",
    emergencyLevel: "high",
    suggestedAgency: "frsc",
    status: "submitted",
    submittedAt: hoursAgo(1),
    timeline: seedTimeline("CIR-FRS002", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 1 },
    ]),
  },
  {
    id: "seed-citizen-frsc-003",
    reference: "CIR-FRS003",
    incidentType: "dangerous_driving",
    description: "Commercial bus repeatedly driving against traffic and forcing vehicles off the shoulder.",
    location: "Murtala Muhammed Airport Road, Ikeja, Lagos",
    latitude: 6.577,
    longitude: 3.321,
    vehicleRegistration: "LSD 882 YA",
    emergencyLevel: "medium",
    suggestedAgency: "frsc",
    status: "in_progress",
    submittedAt: hoursAgo(11),
    timeline: seedTimeline("CIR-FRS003", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 11 },
      { action: "FRSC marked report Triaged", by: "Marshal Adewale Johnson", hoursAgo: 10 },
      { action: "FRSC marked report Assigned", by: "SRC Fatima Bello", hoursAgo: 9 },
      { action: "FRSC marked report In Progress", by: "Marshal Adewale Johnson", hoursAgo: 8 },
    ]),
  },
  {
    id: "seed-citizen-police-004",
    reference: "CIR-POL004",
    incidentType: "robbery",
    description: "Armed robbery reported at a POS kiosk. Two suspects fled on a motorcycle with cash and phones.",
    location: "Rumuola Junction, Port Harcourt, Rivers",
    latitude: 4.8387,
    longitude: 7.0134,
    emergencyLevel: "critical",
    suggestedAgency: "police",
    status: "assigned",
    submittedAt: hoursAgo(5),
    timeline: seedTimeline("CIR-POL004", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 5 },
      { action: "Police marked report Triaged", by: "Insp. Chukwuemeka Okonkwo", hoursAgo: 4 },
      { action: "Police marked report Assigned", by: "DSP Aisha Ibrahim", hoursAgo: 3 },
    ]),
  },
  {
    id: "seed-citizen-police-005",
    reference: "CIR-POL005",
    incidentType: "assault",
    description: "Fight outside a motor park has left one person injured. Crowd is still gathered.",
    location: "Upper Iweka Motor Park, Onitsha, Anambra",
    latitude: 6.1497,
    longitude: 6.7857,
    emergencyLevel: "high",
    suggestedAgency: "police",
    status: "resolved",
    submittedAt: hoursAgo(30),
    timeline: seedTimeline("CIR-POL005", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 30 },
      { action: "Police marked report Triaged", by: "Insp. Chukwuemeka Okonkwo", hoursAgo: 29 },
      { action: "Police marked report Assigned", by: "DSP Aisha Ibrahim", hoursAgo: 28 },
      { action: "Police marked report In Progress", by: "Insp. Chukwuemeka Okonkwo", hoursAgo: 25 },
      { action: "Police marked report Resolved", by: "DSP Aisha Ibrahim", hoursAgo: 20 },
    ]),
  },
  {
    id: "seed-citizen-vio-004",
    reference: "CIR-VIO004",
    incidentType: "commercial_vehicle_safety_issue",
    description: "Interstate bus has cracked windscreen, worn tyres, and no rear indicator lights.",
    location: "Jibowu Bus Terminal, Lagos",
    latitude: 6.5165,
    longitude: 3.3667,
    vehicleRegistration: "KRD 118 XP",
    emergencyLevel: "high",
    suggestedAgency: "vio",
    status: "triaged",
    submittedAt: hoursAgo(4),
    timeline: seedTimeline("CIR-VIO004", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 4 },
      { action: "VIO marked report Triaged", by: "Officer Grace Okafor", hoursAgo: 3 },
    ]),
  },
  {
    id: "seed-citizen-vio-005",
    reference: "CIR-VIO005",
    incidentType: "vehicle_documentation_concern",
    description: "Driver presented vehicle documents with mismatched plate and chassis details.",
    location: "Kano Road Safety Checkpoint, Kano",
    latitude: 12.0311,
    longitude: 8.5246,
    vehicleRegistration: "KNK 204 ZR",
    emergencyLevel: "medium",
    suggestedAgency: "vio",
    status: "closed",
    submittedAt: hoursAgo(60),
    timeline: seedTimeline("CIR-VIO005", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 60 },
      { action: "VIO marked report Triaged", by: "Officer Grace Okafor", hoursAgo: 58 },
      { action: "VIO marked report Resolved", by: "Sr. Inspector Musa Danjuma", hoursAgo: 48 },
      { action: "VIO marked report Closed", by: "Director Ngozi Eze", hoursAgo: 44 },
    ]),
  },
  {
    id: "seed-citizen-nscdc-006",
    reference: "CIR-NSC006",
    incidentType: "crowd_control",
    description: "Large crowd gathering around a fuel queue after a dispute between drivers and attendants.",
    location: "Challenge Roundabout, Ibadan, Oyo",
    latitude: 7.3648,
    longitude: 3.8769,
    emergencyLevel: "medium",
    suggestedAgency: "civil_defence",
    status: "assigned",
    submittedAt: hoursAgo(8),
    timeline: seedTimeline("CIR-NSC006", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 8 },
      { action: "NSCDC marked report Triaged", by: "Officer Binta Sani", hoursAgo: 7 },
      { action: "NSCDC marked report Assigned", by: "Superintendent Ibrahim Musa", hoursAgo: 6 },
    ]),
  },
  {
    id: "seed-citizen-nscdc-007",
    reference: "CIR-NSC007",
    incidentType: "civil_emergency",
    description: "Residential building partially collapsed after heavy rain. Occupants need help retrieving medication and belongings.",
    location: "Barnawa, Kaduna South, Kaduna",
    latitude: 10.4835,
    longitude: 7.4294,
    emergencyLevel: "critical",
    suggestedAgency: "civil_defence",
    status: "in_progress",
    submittedAt: hoursAgo(12),
    timeline: seedTimeline("CIR-NSC007", [
      { action: "Citizen report submitted", by: "Citizen", hoursAgo: 12 },
      { action: "NSCDC marked report Triaged", by: "Officer Binta Sani", hoursAgo: 11 },
      { action: "NSCDC marked report Assigned", by: "Commandant Aisha Bello", hoursAgo: 10 },
      { action: "NSCDC marked report In Progress", by: "Officer Binta Sani", hoursAgo: 9 },
    ]),
  },
];

export const FRSC_CITIZEN_INCIDENT_TYPES: CitizenIncidentType[] = [
  "road_crash",
  "traffic_obstruction",
  "dangerous_driving",
  "vehicle_breakdown",
  "road_hazard",
  "vehicle_theft",
];

export const NSCDC_CITIZEN_INCIDENT_TYPES: CitizenIncidentType[] = [
  "fire_rescue",
  "disaster_response",
  "public_threat",
  "crowd_control",
  "infrastructure_risk",
  "suspicious_activity",
  "civil_emergency",
  "community_safety",
  "security_support_referral",
  "medical",
  "other",
];

export const POLICE_CITIZEN_INCIDENT_TYPES: CitizenIncidentType[] = [
  "theft",
  "robbery",
  "assault",
  "suspicious_activity",
  "public_threat",
  "vehicle_theft",
  "missing_vehicle_alert",
  "security_incident",
  "crime",
];

export const VIO_CITIZEN_INCIDENT_TYPES: CitizenIncidentType[] = [
  "roadworthiness_complaint",
  "dangerous_vehicle",
  "vehicle_inspection_concern",
  "invalid_certificate_concern",
  "commercial_vehicle_safety_issue",
  "vehicle_documentation_concern",
  "vehicle_issue",
];

function hasCoordinates(report: Pick<CitizenIncidentSubmission, "latitude" | "longitude">) {
  return Number.isFinite(report.latitude) && Number.isFinite(report.longitude);
}

function normalizeCitizenIncidentReport(report: CitizenIncidentReceipt): CitizenIncidentReceipt {
  const fallbackLocation = report.location || report.address || "Location not provided";
  return {
    ...report,
    location: fallbackLocation,
    address: report.address || fallbackLocation,
    locationSource: report.locationSource ?? (hasCoordinates(report) ? "gps" : "manual"),
  };
}

function makeReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  return `CIR-${stamp.slice(-6)}`;
}

export async function submitCitizenIncidentMock(
  input: CitizenIncidentSubmission,
): Promise<CitizenIncidentReceipt> {
  await new Promise((resolve) => setTimeout(resolve, 750));

  const receipt: CitizenIncidentReceipt = {
    ...input,
    address: input.address || input.location,
    locationSource: input.locationSource ?? (hasCoordinates(input) ? "gps" : "manual"),
    id: `citizen-${Date.now()}`,
    reference: makeReference(),
    status: "submitted",
    submittedAt: new Date().toISOString(),
    timeline: [
      {
        id: `citizen-tl-${Date.now()}`,
        action: "Citizen report submitted",
        by: "Citizen",
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const existing: CitizenIncidentReceipt[] = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([normalizeCitizenIncidentReport(receipt), ...existing]));

  await createAuditEvent({
    type: "report.submitted",
    title: "Citizen report submitted",
    detail: `${receipt.reference} routed to ${formatCitizenAgencyLabel(receipt.suggestedAgency)}.`,
    actor: { name: "Citizen", agency: "citizen", role: "citizen" },
    agency: receipt.suggestedAgency,
    reportReference: receipt.reference,
    severity: receipt.emergencyLevel === "critical" ? "critical" : receipt.emergencyLevel === "high" ? "warning" : "info",
    metadata: {
      incidentType: receipt.incidentType,
      emergencyLevel: receipt.emergencyLevel,
      locationSource: receipt.locationSource,
    },
  });

  await createNotification({
    type: "citizen_report_submitted",
    audience: "citizen",
    title: "Report submitted",
    message: `Your report ${receipt.reference} has been submitted and routed to ${formatCitizenAgencyLabel(receipt.suggestedAgency)}.`,
    reportReference: receipt.reference,
    route: "/track-report",
    priority: priorityFromEmergency(receipt.emergencyLevel),
    sourceAgency: "citizen",
  });
  await createNotification({
    type: "agency_referral_received",
    audience: "agency",
    agency: receipt.suggestedAgency,
    title: "New citizen report",
    message: `${receipt.reference} was routed to ${formatCitizenAgencyLabel(receipt.suggestedAgency)} for ${receipt.incidentType.replaceAll("_", " ")}.`,
    reportReference: receipt.reference,
    route: agencyRouteForReport(receipt.suggestedAgency),
    priority: priorityFromEmergency(receipt.emergencyLevel),
    sourceAgency: "citizen",
  });
  if (receipt.emergencyLevel === "high" || receipt.emergencyLevel === "critical") {
    await createNotification({
      type: "nearby_high_priority_alert",
      audience: "agency",
      agency: receipt.suggestedAgency,
      title: "High-priority citizen alert",
      message: `${receipt.reference} is marked ${receipt.emergencyLevel.toUpperCase()} at ${receipt.location}.`,
      reportReference: receipt.reference,
      route: agencyRouteForReport(receipt.suggestedAgency),
      priority: priorityFromEmergency(receipt.emergencyLevel),
      sourceAgency: "citizen",
    });
  }

  return normalizeCitizenIncidentReport(receipt);
}

async function readCitizenIncidentReports(): Promise<CitizenIncidentReceipt[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const reports: CitizenIncidentReceipt[] = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(reports)) return SEED_CITIZEN_REPORTS.map(normalizeCitizenIncidentReport);

  const storedIds = new Set(reports.map((report) => report.id));
  const seedsToAdd = SEED_CITIZEN_REPORTS.filter((seed) => !storedIds.has(seed.id));
  const next = seedsToAdd.length > 0 ? [...reports, ...seedsToAdd] : reports;
  if (seedsToAdd.length > 0) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next.map(normalizeCitizenIncidentReport);
}

async function writeCitizenIncidentReports(reports: CitizenIncidentReceipt[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reports.map(normalizeCitizenIncidentReport)));
}

export async function listCitizenIncidentReports(): Promise<CitizenIncidentReceipt[]> {
  return readCitizenIncidentReports();
}

export async function listFrscCitizenIncidentReports(): Promise<CitizenIncidentReceipt[]> {
  return listCitizenIncidentReportsByAgency("frsc");
}

export async function listPoliceCitizenIncidentReports(): Promise<CitizenIncidentReceipt[]> {
  return listCitizenIncidentReportsByAgency("police");
}

export async function listVioCitizenIncidentReports(): Promise<CitizenIncidentReceipt[]> {
  return listCitizenIncidentReportsByAgency("vio");
}

export async function listCitizenIncidentReportsByAgency(
  agency: CitizenAgencyRoute,
): Promise<CitizenIncidentReceipt[]> {
  const reports = await readCitizenIncidentReports();
  return reports.filter((report) => report.suggestedAgency === agency);
}

export async function listNscdcCitizenIncidentReports(): Promise<CitizenIncidentReceipt[]> {
  return listCitizenIncidentReportsByAgency("civil_defence");
}

export async function listReportsWithLocation(): Promise<CitizenIncidentReceipt[]> {
  return readCitizenIncidentReports();
}

export async function listReportsByAgencyWithLocation(
  agency: CitizenAgencyRoute,
): Promise<CitizenIncidentReceipt[]> {
  return listCitizenIncidentReportsByAgency(agency);
}

export function hasCitizenReportCoordinates(report: CitizenIncidentSubmission): boolean {
  return hasCoordinates(report);
}

export function getCitizenReportLocationText(report: CitizenIncidentSubmission): string {
  return report.address || report.location || "Location not provided";
}

export function getCitizenReportCoordinatesText(report: CitizenIncidentSubmission): string | null {
  if (!hasCitizenReportCoordinates(report)) return null;
  return `${report.latitude!.toFixed(5)}, ${report.longitude!.toFixed(5)}`;
}

export function getMapMetrics(reports: CitizenIncidentReceipt[]) {
  const withCoordinates = reports.filter(hasCitizenReportCoordinates).length;
  return {
    total: reports.length,
    withCoordinates,
    withoutCoordinates: reports.length - withCoordinates,
    highEmergency: reports.filter((report) => report.emergencyLevel === "high" || report.emergencyLevel === "critical").length,
    open: reports.filter((report) => report.status !== "resolved" && report.status !== "closed").length,
  };
}

export async function findCitizenIncidentByReference(
  reference: string,
): Promise<CitizenIncidentReceipt | null> {
  const normalized = reference.trim().toUpperCase();
  if (!normalized) return null;

  const reports = await readCitizenIncidentReports();
  return reports.find((report) => report.reference.toUpperCase() === normalized) ?? null;
}

export async function updateCitizenIncidentStatusMock({
  reference,
  status,
  actorName,
  actorAgencyLabel,
}: {
  reference: string;
  status: CitizenIncidentStatus;
  actorName: string;
  actorAgencyLabel?: string;
}): Promise<CitizenIncidentReceipt | null> {
  const normalized = reference.trim().toUpperCase();
  const reports = await readCitizenIncidentReports();
  const now = new Date().toISOString();
  let updated: CitizenIncidentReceipt | null = null;

  const next = reports.map((report) => {
    if (report.reference.toUpperCase() !== normalized) return report;
    updated = {
      ...report,
      status,
      timeline: [
        ...(report.timeline ?? []),
        {
          id: `citizen-tl-${Date.now()}`,
          action: `${actorAgencyLabel ?? "FRSC"} marked report ${formatCitizenIncidentStatus(status)}`,
          by: actorName,
          timestamp: now,
        },
      ],
    };
    return updated;
  });

  const updatedReport = updated as CitizenIncidentReceipt | null;
  if (updatedReport) {
    await writeCitizenIncidentReports(next);
    await createAuditEvent({
      type: "report.status_changed",
      title: "Report status changed",
      detail: `${updatedReport.reference} marked ${formatCitizenIncidentStatus(status)} by ${actorName}.`,
      actor: { name: actorName, agency: updatedReport.suggestedAgency },
      agency: updatedReport.suggestedAgency,
      reportReference: updatedReport.reference,
      severity: updatedReport.emergencyLevel === "critical" ? "critical" : updatedReport.emergencyLevel === "high" ? "warning" : "info",
      metadata: { status, actorAgencyLabel: actorAgencyLabel ?? null },
    });
    await createNotification({
      type: "status_changed",
      audience: "citizen",
      title: "Report status updated",
      message: `${updatedReport.reference} is now ${formatCitizenIncidentStatus(status)}. ${getCitizenStatusMessage(status)}`,
      reportReference: updatedReport.reference,
      route: "/track-report",
      priority: priorityFromEmergency(updatedReport.emergencyLevel),
      sourceAgency: updatedReport.suggestedAgency,
    });
    await createNotification({
      type: status === "assigned" ? "case_assigned" : "status_changed",
      audience: "agency",
      agency: updatedReport.suggestedAgency,
      title: status === "assigned" ? "Case assigned" : "Case status changed",
      message: `${updatedReport.reference} was marked ${formatCitizenIncidentStatus(status)} by ${actorName}.`,
      reportReference: updatedReport.reference,
      route: agencyRouteForReport(updatedReport.suggestedAgency),
      priority: priorityFromEmergency(updatedReport.emergencyLevel),
      sourceAgency: updatedReport.suggestedAgency,
    });
  }
  return updatedReport;
}

export async function reassignCitizenIncidentAgencyMock({
  reference,
  agency,
  actorName,
}: {
  reference: string;
  agency: CitizenAgencyRoute;
  actorName: string;
}): Promise<CitizenIncidentReceipt | null> {
  const normalized = reference.trim().toUpperCase();
  const reports = await readCitizenIncidentReports();
  const now = new Date().toISOString();
  let updated: CitizenIncidentReceipt | null = null;

  const next = reports.map((report) => {
    if (report.reference.toUpperCase() !== normalized) return report;
    updated = {
      ...report,
      suggestedAgency: agency,
      timeline: [
        ...(report.timeline ?? []),
        {
          id: `citizen-tl-${Date.now()}`,
          action: `Agency reassigned to ${formatCitizenAgencyLabel(agency)}`,
          by: actorName,
          timestamp: now,
        },
      ],
    };
    return updated;
  });

  const updatedReport = updated as CitizenIncidentReceipt | null;
  if (updatedReport) {
    await writeCitizenIncidentReports(next);
    await createAuditEvent({
      type: "report.reassigned",
      title: "Report reassigned",
      detail: `${actorName} reassigned ${updatedReport.reference} to ${formatCitizenAgencyLabel(agency)}.`,
      actor: { name: actorName, agency: "admin" },
      agency,
      reportReference: updatedReport.reference,
      severity: updatedReport.emergencyLevel === "critical" ? "critical" : "warning",
      metadata: { targetAgency: agency },
    });
    await createNotification({
      type: "report_reassigned",
      audience: "citizen",
      title: "Report reassigned",
      message: `${updatedReport.reference} has been reassigned to ${formatCitizenAgencyLabel(agency)} for handling.`,
      reportReference: updatedReport.reference,
      route: "/track-report",
      priority: priorityFromEmergency(updatedReport.emergencyLevel),
      sourceAgency: "admin",
    });
    await createNotification({
      type: "report_reassigned",
      audience: "agency",
      agency,
      title: "Report reassigned to your agency",
      message: `${updatedReport.reference} was reassigned to ${formatCitizenAgencyLabel(agency)} by ${actorName}.`,
      reportReference: updatedReport.reference,
      route: agencyRouteForReport(agency),
      priority: priorityFromEmergency(updatedReport.emergencyLevel),
      sourceAgency: "admin",
    });
    await createNotification({
      type: "admin_action",
      audience: "admin",
      agency: "admin",
      title: "Agency reassignment completed",
      message: `${actorName} reassigned ${updatedReport.reference} to ${formatCitizenAgencyLabel(agency)}.`,
      reportReference: updatedReport.reference,
      route: "/(admin)/incidents",
      priority: "normal",
      sourceAgency: "admin",
    });
  }
  return updatedReport;
}

export async function appendCitizenIncidentTimelineMock({
  reference,
  action,
  actorName,
}: {
  reference: string;
  action: string;
  actorName: string;
}): Promise<CitizenIncidentReceipt | null> {
  const normalized = reference.trim().toUpperCase();
  const reports = await readCitizenIncidentReports();
  const now = new Date().toISOString();
  let updated: CitizenIncidentReceipt | null = null;

  const next = reports.map((report) => {
    if (report.reference.toUpperCase() !== normalized) return report;
    updated = {
      ...report,
      timeline: [
        ...(report.timeline ?? []),
        {
          id: `citizen-tl-${Date.now()}`,
          action,
          by: actorName,
          timestamp: now,
        },
      ],
    };
    return updated;
  });

  if (updated) await writeCitizenIncidentReports(next);
  return updated;
}

export function formatCitizenIncidentStatus(status: CitizenIncidentStatus): string {
  const labels: Record<CitizenIncidentStatus, string> = {
    submitted: "Submitted",
    triaged: "Triaged",
    assigned: "Assigned",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };
  return labels[status];
}

export function getCitizenStatusMessage(status: CitizenIncidentStatus): string {
  const messages: Record<CitizenIncidentStatus, string> = {
    submitted: "Your report has been received and is waiting for review.",
    triaged: "Your report has been reviewed and routed to the appropriate response team.",
    assigned: "A response officer or team has been assigned to your report.",
    in_progress: "Responders are currently working on this report.",
    resolved: "This report has been marked as resolved.",
    closed: "This report has been closed. Thank you for helping improve community safety.",
  };
  return messages[status];
}

export function formatCitizenAgencyLabel(agency: CitizenAgencyRoute): string {
  const labels: Record<CitizenAgencyRoute, string> = {
    frsc: "FRSC",
    police: "Nigeria Police",
    vio: "VIO",
    civil_defence: "Civil Defence / NSCDC",
  };
  return labels[agency];
}

function agencyRouteForReport(agency: CitizenAgencyRoute): string {
  const routes: Record<CitizenAgencyRoute, string> = {
    frsc: "/(tabs)/cases",
    police: "/(police)/crime-reports",
    vio: "/(vio)/inspections",
    civil_defence: "/(civil-defence)/incidents",
  };
  return routes[agency];
}
