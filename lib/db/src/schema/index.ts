import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const agencyType = pgEnum("agency_type", [
  "frsc",
  "police",
  "vio",
  "civil_defence",
  "fire_service",
  "emergency_management",
  "state_traffic",
  "ambulance",
  "hospital",
  "insurance",
  "towing",
]);

export const userRole = pgEnum("user_role", [
  "admin",
  "commander",
  "supervisor",
  "field_officer",
  "investigator",
  "analyst",
  "partner",
  "citizen",
]);

export const caseStatus = pgEnum("case_status", [
  "new",
  "assigned",
  "investigating",
  "referred",
  "resolved",
  "closed",
]);

export const referralStatus = pgEnum("referral_status", [
  "pending",
  "acknowledged",
  "actioned",
  "closed",
]);

export const evidenceKind = pgEnum("evidence_kind", [
  "photo",
  "video",
  "audio",
  "document",
  "statement",
  "other",
]);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyType: agencyType("agency_type").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    primaryColor: text("primary_color").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    agencyTypeIdx: index("tenants_agency_type_idx").on(table.agencyType),
    shortNameIdx: uniqueIndex("tenants_short_name_idx").on(table.shortName),
  }),
);

export const agencyUnits = pgTable(
  "agency_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    parentUnitId: uuid("parent_unit_id"),
    name: text("name").notNull(),
    level: text("level").notNull(),
    state: text("state"),
    lga: text("lga"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("agency_units_tenant_idx").on(table.tenantId),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    unitId: uuid("unit_id").references(() => agencyUnits.id),
    name: text("name").notNull(),
    badgeNumber: text("badge_number").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    role: userRole("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    pinHash: text("pin_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("users_tenant_idx").on(table.tenantId),
    badgeTenantIdx: uniqueIndex("users_badge_tenant_idx").on(
      table.tenantId,
      table.badgeNumber,
    ),
  }),
);

export const citizenProfiles = pgTable("citizen_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const caseTypes = pgTable(
  "case_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    primaryAgencyType: agencyType("primary_agency_type").notNull(),
    workflow: jsonb("workflow")
      .$type<string[]>()
      .notNull()
      .default(["new", "assigned", "investigating", "resolved", "closed"]),
    requiredFields: jsonb("required_fields")
      .$type<string[]>()
      .notNull()
      .default([]),
    slaMinutes: integer("sla_minutes").notNull().default(1440),
    documentTemplate: text("document_template"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantCodeIdx: uniqueIndex("case_types_tenant_code_idx").on(
      table.tenantId,
      table.code,
    ),
  }),
);

export const cases = pgTable(
  "cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    caseTypeId: uuid("case_type_id").references(() => caseTypes.id),
    reporterId: uuid("reporter_id").references(() => citizenProfiles.id),
    assignedToId: uuid("assigned_to_id").references(() => users.id),
    status: caseStatus("status").notNull().default("new"),
    priority: text("priority").notNull().default("normal"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    location: jsonb("location").$type<Record<string, unknown>>().notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    offlineClientId: text("offline_client_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => ({
    referenceIdx: uniqueIndex("cases_reference_idx").on(table.reference),
    tenantStatusIdx: index("cases_tenant_status_idx").on(
      table.tenantId,
      table.status,
    ),
    assigneeIdx: index("cases_assignee_idx").on(table.assignedToId),
  }),
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    uploadedById: uuid("uploaded_by_id").references(() => users.id),
    kind: evidenceKind("kind").notNull(),
    uri: text("uri").notNull(),
    checksum: text("checksum").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    caseIdx: index("evidence_case_idx").on(table.caseId),
  }),
);

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    fromTenantId: uuid("from_tenant_id")
      .notNull()
      .references(() => tenants.id),
    toTenantId: uuid("to_tenant_id")
      .notNull()
      .references(() => tenants.id),
    status: referralStatus("status").notNull().default("pending"),
    reason: text("reason").notNull(),
    notes: jsonb("notes")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    toTenantStatusIdx: index("referrals_to_tenant_status_idx").on(
      table.toTenantId,
      table.status,
    ),
    caseIdx: index("referrals_case_idx").on(table.caseId),
  }),
);

export const dutySessions = pgTable(
  "duty_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    officerId: uuid("officer_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("on_duty"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    startLocation: jsonb("start_location").$type<Record<string, unknown>>(),
    endLocation: jsonb("end_location").$type<Record<string, unknown>>(),
    patrolLog: jsonb("patrol_log")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
  },
  (table) => ({
    officerIdx: index("duty_sessions_officer_idx").on(table.officerId),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantCreatedIdx: index("audit_logs_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
    ),
    entityIdx: index("audit_logs_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
  }),
);
