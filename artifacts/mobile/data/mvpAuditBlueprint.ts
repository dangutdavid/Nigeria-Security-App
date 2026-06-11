import { AgencyConfig } from "@/context/AgencyContext";

export type AuditStatus = "implemented" | "partial" | "not_implemented" | "future_phase";

export interface AuditChecklistItem {
  id: string;
  title: string;
  description: string;
  status: AuditStatus;
  evidence: string;
  priority?: "P0" | "P1" | "P2";
}

export interface AgencyModuleBlueprint {
  id: string;
  shortName: string;
  fullName: string;
  primaryColor: string;
  icon: string;
  implementationState: "live_mvp" | "blueprint";
  commonCapabilities: string[];
  agencyModules: string[];
  routingRules: string[];
}

export const COMMON_PLATFORM_CAPABILITIES = [
  "Identity, role-based access and tenant routing",
  "Public and internal incident reporting",
  "Shared case reference, status and evidence model",
  "GPS/manual location capture, mapping and dispatch metadata",
  "Cross-agency referrals with inbox/outbox visibility",
  "Operational dashboards, hotspots and export-ready analytics",
  "Duty session, patrol log, offline queue and sync controls",
  "Document templates, QR verification and controlled partner access",
];

export const MVP_AUDIT_CHECKLIST: AuditChecklistItem[] = [
  {
    id: "tenant-routing",
    title: "Agency selector and tenant routing",
    description: "FRSC, Nigeria Police Force and VIO users select an agency before officer sign-in.",
    status: "implemented",
    evidence: "Agency cards route officers into agency-specific login and tab groups.",
    priority: "P0",
  },
  {
    id: "rbac",
    title: "Role-based access control",
    description: "Admin, supervisor/commander and field officer tools must be separated by role and agency.",
    status: "partial",
    evidence: "Demo roles gate some screens; server-side tenant permissions and audit trails remain required.",
    priority: "P0",
  },
  {
    id: "stolen-vehicle-report",
    title: "Citizen stolen vehicle report",
    description: "Citizen submits a theft report, receives a reference and routes the record to Police queues.",
    status: "implemented",
    evidence: "Public theft reporting, alerts and plate intelligence exist in the MVP; backend persistence is still demo/local-first.",
    priority: "P0",
  },
  {
    id: "crash-report",
    title: "FRSC crash report workflow",
    description: "Capture crash severity, location, casualties, vehicles, probable causes and evidence.",
    status: "implemented",
    evidence: "FRSC incident wizard and case management support crash field reports with offline-first storage.",
    priority: "P0",
  },
  {
    id: "case-assignment-referrals",
    title: "Case assignment and cross-agency referrals",
    description: "Supervisors assign work, officers receive records, and agencies explicitly refer cases to one another.",
    status: "implemented",
    evidence: "Assignment and referral contexts are present; production SLA notifications and backend queues remain next steps.",
    priority: "P0",
  },
  {
    id: "vehicle-lookup",
    title: "Vehicle lookup service/mock",
    description: "Plate lookup returns stolen flags, registration summary and document/roadworthiness indicators.",
    status: "implemented",
    evidence: "MVP includes a local vehicle database and cross-agency plate flag banner.",
    priority: "P1",
  },
  {
    id: "duty-session",
    title: "Duty session and patrol log",
    description: "Start/end duty, log encounters, capture timestamps and link patrol activity to field work.",
    status: "implemented",
    evidence: "Patrol log and profile duty status are available; GPS route replay remains a production integration task.",
    priority: "P1",
  },
  {
    id: "offline-sync",
    title: "Offline mode and sync queue",
    description: "Field officers can create/update records offline and sync later with conflict handling.",
    status: "partial",
    evidence: "Local pending-sync behaviour is present; encrypted device storage, retry telemetry and server reconciliation are still required.",
    priority: "P1",
  },
  {
    id: "analytics-hotspots",
    title: "Analytics and hotspot dashboards",
    description: "Operational trends, case counts, hotspots and filters by agency/state/type/date/severity.",
    status: "implemented",
    evidence: "FRSC, Police and VIO dashboards exist with demo operational insights and hotspot summaries.",
    priority: "P1",
  },
  {
    id: "documents-qr",
    title: "Document generation and QR verification",
    description: "Generate official crash, theft or inspection reports with verifiable QR pages.",
    status: "future_phase",
    evidence: "Blueprinted as a shared platform module; PDF generation, QR verification route and approval controls are not yet implemented.",
    priority: "P1",
  },
  {
    id: "payments-ai-partners",
    title: "Payments, AI triage and partner portals",
    description: "Support fines/fees, duplicate detection, summaries, hospital/insurance/towing controlled access.",
    status: "future_phase",
    evidence: "Planned P2 capabilities after core tenant security, workflows and document generation are production-backed.",
    priority: "P2",
  },
];

export const AGENCY_MODULE_BLUEPRINTS: AgencyModuleBlueprint[] = [
  {
    id: "frsc",
    shortName: "FRSC",
    fullName: "Federal Road Safety Corps",
    primaryColor: "#1B5E3B",
    icon: "shield",
    implementationState: "live_mvp",
    commonCapabilities: ["Crash case management", "Traffic enforcement", "Duty patrols", "Hotspot analytics"],
    agencyModules: [
      "Road crash reporting and investigation",
      "Casualty, hospital and towing handover",
      "Road obstruction and dangerous driving reports",
      "Accident report generation for insurance/legal follow-up",
    ],
    routingRules: ["Road crash with injury → FRSC + hospital/ambulance", "Fatal crash → FRSC + Police + hospital"],
  },
  {
    id: "police",
    shortName: "NPF",
    fullName: "Nigeria Police Force",
    primaryColor: "#1A3A6C",
    icon: "star",
    implementationState: "live_mvp",
    commonCapabilities: ["Crime reports", "Vehicle theft alerts", "Investigation queues", "Referral inbox"],
    agencyModules: [
      "Vehicle theft and stolen property registry",
      "Investigation case files, statements and evidence timeline",
      "Wanted vehicles/persons watchlist",
      "Controlled police report requests",
    ],
    routingRules: ["Vehicle theft → Police + VIO registry", "Stolen plate number → Police + VIO"],
  },
  {
    id: "vio",
    shortName: "VIO",
    fullName: "Vehicle Inspection Officers/Service",
    primaryColor: "#7B3F00",
    icon: "clipboard",
    implementationState: "live_mvp",
    commonCapabilities: ["Inspection cases", "Certificate list", "Plate intelligence", "Referral inbox"],
    agencyModules: [
      "Roadworthiness inspection checklist",
      "Defect notice and reinspection workflow",
      "Vehicle compliance checks",
      "Impound tracking blueprint",
    ],
    routingRules: ["Fake/expired vehicle documents → VIO + Police", "Roadworthiness issue → VIO"],
  },
  {
    id: "civil_defence",
    shortName: "NSCDC",
    fullName: "Nigeria Security and Civil Defence Corps",
    primaryColor: "#305C36",
    icon: "lock",
    implementationState: "blueprint",
    commonCapabilities: ["Incident reporting", "Facility patrols", "Dispatch", "Risk scoring"],
    agencyModules: ["Critical infrastructure protection", "Vandalism reporting", "Private security licensing", "Community intelligence tips"],
    routingRules: ["Pipeline vandalism → Civil Defence + Police", "Crowd/event security → Civil Defence"],
  },
  {
    id: "fire_service",
    shortName: "Fire",
    fullName: "Fire Service",
    primaryColor: "#C0392B",
    icon: "zap",
    implementationState: "blueprint",
    commonCapabilities: ["Emergency reporting", "Dispatch", "Mapping", "Investigation records"],
    agencyModules: ["Fire incident reporting", "Fire truck dispatch", "Hydrant mapping", "Building fire inspection and certificates"],
    routingRules: ["Fire outbreak → Fire Service + Civil Defence + Police"],
  },
  {
    id: "emergency_management",
    shortName: "NEMA/SEMA",
    fullName: "Emergency Management Agencies",
    primaryColor: "#6C3483",
    icon: "activity",
    implementationState: "blueprint",
    commonCapabilities: ["Multi-agency coordination", "Shelter/camp records", "Situation reports", "Relief logistics"],
    agencyModules: ["Disaster reporting", "Relief distribution", "Shelter/camp management", "Daily situation reports"],
    routingRules: ["Flood/disaster → NEMA/SEMA + Civil Defence + Police + FRSC"],
  },
  {
    id: "partners",
    shortName: "Partners",
    fullName: "Ambulance, Hospital and Insurance Partners",
    primaryColor: "#0E7490",
    icon: "briefcase",
    implementationState: "blueprint",
    commonCapabilities: ["Controlled external access", "Document verification", "Referral tracking", "Audit logging"],
    agencyModules: ["Emergency patient intake", "Ambulance dispatch", "Accident/theft claim verification", "Fraud detection support"],
    routingRules: ["Crash casualty → hospital handover", "Insurance claim → verified FRSC/Police document"],
  },
];

export function agencyBlueprintFor(config: AgencyConfig): AgencyModuleBlueprint | undefined {
  return AGENCY_MODULE_BLUEPRINTS.find((agency) => agency.id === config.id);
}
