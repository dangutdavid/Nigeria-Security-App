import { z } from "zod";

export const AgencyTypeSchema = z.enum([
  "frsc",
  "police",
  "vio",
  "civil_defence",
  "admin",
  "citizen",
  "dss",
  "fire_service",
  "custom",
]);

export const RoleSchema = z.enum([
  "citizen",
  "officer",
  "supervisor",
  "commander",
  "admin",
  "super_admin",
]);

export const CaseStatusSchema = z.enum([
  "submitted",
  "triaged",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "rejected",
]);

export const ReferralStatusSchema = z.enum([
  "pending",
  "acknowledged",
  "actioned",
  "closed",
]);

export const CaseKindSchema = z.enum([
  "road_crash",
  "traffic_obstruction",
  "dangerous_driving",
  "vehicle_breakdown",
  "road_hazard",
  "theft",
  "robbery",
  "assault",
  "suspicious_activity",
  "public_threat",
  "vehicle_theft",
  "missing_vehicle_alert",
  "security_incident",
  "roadworthiness_complaint",
  "dangerous_vehicle",
  "vehicle_inspection_concern",
  "invalid_certificate_concern",
  "commercial_vehicle_safety_issue",
  "vehicle_documentation_concern",
  "fire_rescue",
  "disaster",
  "civil_emergency",
  "infrastructure_risk",
  "custom",
]);

export const PrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const LocationSchema = z.object({
  address: z.string().min(3),
  state: z.string().min(2).optional(),
  lga: z.string().min(2).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  source: z.enum(["gps", "manual"]).default("manual"),
  accuracy: z.number().optional(),
});

export const EvidenceInputSchema = z.object({
  kind: z.enum(["photo", "video", "audio", "document", "statement", "other"]),
  uri: z.string().min(1),
  checksum: z.string().min(8).optional(),
  capturedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CitizenReportInputSchema = z.object({
  clientMutationId: z.string().min(3).optional(),
  kind: CaseKindSchema,
  reporter: z.object({
    fullName: z.string().min(2),
    phone: z.string().min(7),
    email: z.string().email().optional(),
  }),
  title: z.string().min(4),
  description: z.string().min(10),
  location: LocationSchema,
  priority: PrioritySchema.default("medium"),
  vehicle: z
    .object({
      plate: z.string().min(3).optional(),
      registrationNumber: z.string().min(3).optional(),
      make: z.string().optional(),
      model: z.string().optional(),
      color: z.string().optional(),
      year: z.string().optional(),
    })
    .optional(),
  crash: z
    .object({
      casualties: z.number().int().min(0).default(0),
      vehiclesInvolved: z.number().int().min(0).default(0),
      injurySeverity: z.enum(["none", "minor", "serious", "fatal"]).optional(),
    })
    .optional(),
  evidence: z.array(EvidenceInputSchema).default([]),
});

// ---- Mobile citizen incident report ----
// Aligned with the mobile `CitizenIncidentReceipt`/`CitizenIncidentSubmission`
// model (services/citizenIncidentApi.ts) so the backend can accept exactly what
// the Expo app submits and return a report in the same shape the screens expect.
export const CitizenIncidentTypeSchema = z.enum([
  "road_crash",
  "traffic_obstruction",
  "dangerous_driving",
  "vehicle_breakdown",
  "road_hazard",
  "vehicle_theft",
  "theft",
  "robbery",
  "assault",
  "missing_vehicle_alert",
  "security_incident",
  "crime",
  "fire_rescue",
  "disaster_response",
  "public_threat",
  "crowd_control",
  "infrastructure_risk",
  "suspicious_activity",
  "civil_emergency",
  "community_safety",
  "security_support_referral",
  "vehicle_issue",
  "roadworthiness_complaint",
  "dangerous_vehicle",
  "vehicle_inspection_concern",
  "invalid_certificate_concern",
  "commercial_vehicle_safety_issue",
  "vehicle_documentation_concern",
  "medical",
  "other",
]);

export const CitizenEmergencyLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const CitizenAgencyRouteSchema = z.enum(["frsc", "police", "vio", "civil_defence"]);
export const CitizenLocationSourceSchema = z.enum(["gps", "manual"]);
export const CitizenIncidentStatusSchema = z.enum([
  "submitted",
  "triaged",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
]);

export const CitizenReportSubmissionSchema = z.object({
  incidentType: CitizenIncidentTypeSchema,
  description: z.string().min(1),
  location: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
  locationSource: CitizenLocationSourceSchema.optional(),
  accuracy: z.number().optional(),
  photoUri: z.string().optional(),
  vehicleRegistration: z.string().optional(),
  // Tolerated alias for the same field used by some contract callers.
  vehicleRegistrationNumber: z.string().optional(),
  emergencyLevel: CitizenEmergencyLevelSchema,
  suggestedAgency: CitizenAgencyRouteSchema,
  // Optional contact / evidence metadata, stored as-is when provided.
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  evidence: z.array(z.record(z.unknown())).optional(),
});

export const CitizenReportTimelineEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  by: z.string(),
  timestamp: z.string(),
});

export type CitizenIncidentType = z.infer<typeof CitizenIncidentTypeSchema>;
export type CitizenEmergencyLevel = z.infer<typeof CitizenEmergencyLevelSchema>;
export type CitizenAgencyRoute = z.infer<typeof CitizenAgencyRouteSchema>;
export type CitizenIncidentStatus = z.infer<typeof CitizenIncidentStatusSchema>;
export type CitizenReportSubmission = z.infer<typeof CitizenReportSubmissionSchema>;
export type CitizenReportTimelineEntry = z.infer<typeof CitizenReportTimelineEntrySchema>;

// ---- Citizen chat assistant ----
export const AssistantChatRoleSchema = z.enum(["user", "assistant"]);
export const AssistantChatMessageSchema = z.object({
  role: AssistantChatRoleSchema,
  content: z.string().min(1).max(4000),
});
export const AssistantChatRequestSchema = z.object({
  messages: z.array(AssistantChatMessageSchema).min(1).max(40),
  context: z
    .object({
      reportReference: z.string().optional(),
      suggestedAgency: CitizenAgencyRouteSchema.optional(),
    })
    .optional(),
});
export type AssistantChatRole = z.infer<typeof AssistantChatRoleSchema>;
export type AssistantChatMessage = z.infer<typeof AssistantChatMessageSchema>;
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;

export const OfficerLoginInputSchema = z.object({
  agency: AgencyTypeSchema,
  badgeNumber: z.string().min(2),
  pin: z.string().min(4).max(12),
});

export const AssignCaseInputSchema = z.object({
  officerId: z.string().min(2),
  note: z.string().min(2).optional(),
});

export const UpdateCaseStatusInputSchema = z.object({
  status: CaseStatusSchema,
  note: z.string().min(2).optional(),
});

export const CreateReferralInputSchema = z.object({
  toAgency: AgencyTypeSchema,
  reason: z.string().min(5),
  note: z.string().optional(),
  dueAt: z.string().datetime().optional(),
});

export const DutySessionInputSchema = z.object({
  action: z.enum(["start", "end"]),
  location: LocationSchema.partial().optional(),
});

export const SyncOperationSchema = z.object({
  clientMutationId: z.string().min(3),
  operation: z.enum([
    "create_case",
    "update_case_status",
    "assign_case",
    "create_referral",
  ]),
  payload: z.record(z.unknown()),
  capturedAt: z.string().datetime(),
});

export const OfflineSyncInputSchema = z.object({
  deviceId: z.string().min(3),
  operations: z.array(SyncOperationSchema).min(1),
});

export const TenantConfigSchema = z.object({
  id: z.string(),
  agency: AgencyTypeSchema,
  name: z.string(),
  shortName: z.string(),
  primaryColor: z.string(),
  workflows: z.array(
    z.object({
      kind: CaseKindSchema,
      stages: z.array(CaseStatusSchema),
      requiredFields: z.array(z.string()),
      slaMinutes: z.number().int().positive(),
      documentTemplate: z.string(),
    }),
  ),
  permissions: z.record(z.array(z.string())),
});

export type AgencyType = z.infer<typeof AgencyTypeSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type CaseStatus = z.infer<typeof CaseStatusSchema>;
export type ReferralStatus = z.infer<typeof ReferralStatusSchema>;
export type CaseKind = z.infer<typeof CaseKindSchema>;
export type CitizenReportInput = z.infer<typeof CitizenReportInputSchema>;
export type OfficerLoginInput = z.infer<typeof OfficerLoginInputSchema>;
export type AssignCaseInput = z.infer<typeof AssignCaseInputSchema>;
export type UpdateCaseStatusInput = z.infer<typeof UpdateCaseStatusInputSchema>;
export type CreateReferralInput = z.infer<typeof CreateReferralInputSchema>;
export type DutySessionInput = z.infer<typeof DutySessionInputSchema>;
export type OfflineSyncInput = z.infer<typeof OfflineSyncInputSchema>;
