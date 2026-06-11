import { randomUUID, createHash } from "node:crypto";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  AssignCaseInputSchema,
  CitizenReportInputSchema,
  CreateReferralInputSchema,
  DutySessionInputSchema,
  OfflineSyncInputSchema,
  OfficerLoginInputSchema,
  UpdateCaseStatusInputSchema,
  type AgencyType,
  type CaseKind,
  type CaseStatus,
  type Role,
} from "@workspace/api-zod";

interface TenantConfig {
  id: string;
  agency: AgencyType;
  name: string;
  shortName: string;
  primaryColor: string;
  workflows: Array<{
    kind: CaseKind;
    stages: CaseStatus[];
    requiredFields: string[];
    slaMinutes: number;
    documentTemplate: string;
  }>;
  permissions: Record<Role, string[]>;
}

interface Officer {
  id: string;
  tenantId: string;
  agency: AgencyType;
  badgeNumber: string;
  pin: string;
  name: string;
  role: Role;
  station: string;
  sector: string;
  email: string;
  active: boolean;
}

interface PlatformCase {
  id: string;
  reference: string;
  tenantId: string;
  kind: CaseKind;
  status: CaseStatus;
  priority: "low" | "normal" | "high" | "critical";
  title: string;
  description: string;
  location: Record<string, unknown>;
  reporter: { fullName: string; phone: string; email?: string };
  vehicle?: Record<string, unknown>;
  crash?: Record<string, unknown>;
  evidence: Array<Record<string, unknown>>;
  assignedTo?: string;
  timeline: Array<{ at: string; action: string; actor: string; note?: string }>;
  offlineClientId?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

interface Referral {
  id: string;
  caseId: string;
  fromTenantId: string;
  toTenantId: string;
  toAgency: AgencyType;
  reason: string;
  status: "pending" | "acknowledged" | "actioned" | "closed";
  note?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface DutySession {
  id: string;
  tenantId: string;
  officerId: string;
  status: "on_duty" | "off_duty";
  startedAt: string;
  endedAt?: string;
  startLocation?: Record<string, unknown>;
  endLocation?: Record<string, unknown>;
}

interface AuditLog {
  id: string;
  tenantId?: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface RequestActor {
  userId: string;
  tenantId: string;
  agency: AgencyType;
  role: Role;
}

type AuthedRequest = Request & { actor?: RequestActor };

interface SafeParser<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { flatten(): unknown } };
}

const COMMON_PERMISSIONS = [
  "case:read",
  "case:update",
  "evidence:create",
  "duty:write",
];
const SUPERVISOR_PERMISSIONS = [
  ...COMMON_PERMISSIONS,
  "case:assign",
  "referral:create",
  "audit:read",
];
const ADMIN_PERMISSIONS = [
  ...SUPERVISOR_PERMISSIONS,
  "tenant:manage",
  "user:manage",
  "export:case",
];

const tenants: TenantConfig[] = [
  {
    id: "tenant-frsc",
    agency: "frsc",
    name: "Federal Road Safety Corps",
    shortName: "FRSC",
    primaryColor: "#1B5E3B",
    workflows: [
      {
        kind: "road_crash",
        stages: [
          "new",
          "assigned",
          "investigating",
          "referred",
          "resolved",
          "closed",
        ],
        requiredFields: ["location", "vehicles", "casualties", "evidence"],
        slaMinutes: 15,
        documentTemplate: "FRSC crash report with QR verification",
      },
      {
        kind: "dangerous_driving",
        stages: ["new", "assigned", "investigating", "resolved", "closed"],
        requiredFields: ["plate", "location", "description"],
        slaMinutes: 60,
        documentTemplate: "FRSC enforcement report",
      },
    ],
    permissions: {
      admin: ADMIN_PERMISSIONS,
      commander: ADMIN_PERMISSIONS,
      supervisor: SUPERVISOR_PERMISSIONS,
      field_officer: COMMON_PERMISSIONS,
      investigator: COMMON_PERMISSIONS,
      analyst: ["case:read", "audit:read"],
      partner: [],
      citizen: [],
    },
  },
  {
    id: "tenant-police",
    agency: "police",
    name: "Nigeria Police Force",
    shortName: "NPF",
    primaryColor: "#1A3A6C",
    workflows: [
      {
        kind: "vehicle_theft",
        stages: [
          "new",
          "assigned",
          "investigating",
          "referred",
          "resolved",
          "closed",
        ],
        requiredFields: ["plate", "owner_contact", "location", "evidence"],
        slaMinutes: 30,
        documentTemplate: "Police theft report with QR verification",
      },
      {
        kind: "stolen_plate",
        stages: ["new", "assigned", "investigating", "resolved", "closed"],
        requiredFields: ["plate", "location", "reporter"],
        slaMinutes: 60,
        documentTemplate: "Police stolen plate report",
      },
    ],
    permissions: {
      admin: ADMIN_PERMISSIONS,
      commander: ADMIN_PERMISSIONS,
      supervisor: SUPERVISOR_PERMISSIONS,
      field_officer: COMMON_PERMISSIONS,
      investigator: [...COMMON_PERMISSIONS, "referral:create"],
      analyst: ["case:read", "audit:read"],
      partner: [],
      citizen: [],
    },
  },
  {
    id: "tenant-vio",
    agency: "vio",
    name: "Vehicle Inspection Officers",
    shortName: "VIO",
    primaryColor: "#7B3F00",
    workflows: [
      {
        kind: "vehicle_inspection",
        stages: ["new", "assigned", "investigating", "resolved", "closed"],
        requiredFields: ["plate", "inspection_items", "roadworthiness"],
        slaMinutes: 1440,
        documentTemplate: "VIO inspection certificate with QR verification",
      },
    ],
    permissions: {
      admin: ADMIN_PERMISSIONS,
      commander: ADMIN_PERMISSIONS,
      supervisor: SUPERVISOR_PERMISSIONS,
      field_officer: COMMON_PERMISSIONS,
      investigator: COMMON_PERMISSIONS,
      analyst: ["case:read", "audit:read"],
      partner: [],
      citizen: [],
    },
  },
];

const officers: Officer[] = [
  {
    id: "u-frsc-1",
    tenantId: "tenant-frsc",
    agency: "frsc",
    badgeNumber: "CMD-007",
    pin: "1234",
    name: "Brig. Usman Aliyu",
    role: "commander",
    station: "Abuja Command",
    sector: "FCT Sector",
    email: "usman.aliyu@frsc.gov.ng",
    active: true,
  },
  {
    id: "u-police-1",
    tenantId: "tenant-police",
    agency: "police",
    badgeNumber: "NPF-112",
    pin: "1234",
    name: "Inspector Grace Musa",
    role: "investigator",
    station: "Ikeja Division",
    sector: "Lagos Command",
    email: "grace.musa@npf.gov.ng",
    active: true,
  },
  {
    id: "u-vio-1",
    tenantId: "tenant-vio",
    agency: "vio",
    badgeNumber: "VIO-204",
    pin: "1234",
    name: "Officer Chinedu Okeke",
    role: "supervisor",
    station: "Mabushi Office",
    sector: "FCT Directorate",
    email: "chinedu.okeke@vio.gov.ng",
    active: true,
  },
];

const cases: PlatformCase[] = [];
const referrals: Referral[] = [];
const dutySessions: DutySession[] = [];
const auditLogs: AuditLog[] = [];

const router = Router();

function now(): string {
  return new Date().toISOString();
}

function hashEvidence(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function caseReference(kind: CaseKind): string {
  const prefix =
    kind === "vehicle_theft" || kind === "stolen_plate"
      ? "NPF"
      : kind === "vehicle_inspection"
        ? "VIO"
        : "FRSC";
  return `${prefix}-${new Date().getUTCFullYear()}-${String(cases.length + 1).padStart(5, "0")}`;
}

function tenantForAgency(agency: AgencyType): TenantConfig {
  const tenant = tenants.find((item) => item.agency === agency);
  if (!tenant) {
    throw new Error(`No tenant configured for ${agency}`);
  }
  return tenant;
}

function primaryAgencyFor(kind: CaseKind): AgencyType {
  const routing: Record<CaseKind, AgencyType> = {
    road_crash: "frsc",
    vehicle_theft: "police",
    stolen_plate: "police",
    vehicle_inspection: "vio",
    road_obstruction: "frsc",
    vandalism: "civil_defence",
    fire: "fire_service",
    disaster: "emergency_management",
    dangerous_driving: "frsc",
  };
  return routing[kind];
}

function audit(input: Omit<AuditLog, "id" | "createdAt">): AuditLog {
  const log = { ...input, id: randomUUID(), createdAt: now() };
  auditLogs.unshift(log);
  return log;
}

function requireActor(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const agency = req.header("x-agency") as AgencyType | undefined;
  const userId = req.header("x-user-id") ?? "u-frsc-1";
  const role = (req.header("x-user-role") ?? "commander") as Role;
  const tenant = agency
    ? tenants.find((item) => item.agency === agency)
    : tenants[0];

  if (!tenant) {
    res.status(401).json({ error: "Unknown or missing agency tenant" });
    return;
  }

  req.actor = { userId, role, tenantId: tenant.id, agency: tenant.agency };
  next();
}

function can(actor: RequestActor, permission: string): boolean {
  const tenant = tenants.find((item) => item.id === actor.tenantId);
  return tenant?.permissions[actor.role]?.includes(permission) ?? false;
}

function requirePermission(permission: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.actor || !can(req.actor, permission)) {
      res.status(403).json({ error: `Missing permission: ${permission}` });
      return;
    }
    next();
  };
}

function visibleCasesFor(actor: RequestActor): PlatformCase[] {
  const sharedCaseIds = referrals
    .filter(
      (referral) =>
        referral.toTenantId === actor.tenantId ||
        referral.fromTenantId === actor.tenantId,
    )
    .map((referral) => referral.caseId);
  return cases.filter(
    (item) =>
      item.tenantId === actor.tenantId || sharedCaseIds.includes(item.id),
  );
}

function parseBody<T>(
  schema: SafeParser<T>,
  req: Request,
  res: Response,
): T | undefined {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res
      .status(400)
      .json({ error: "Validation failed", issues: result.error.flatten() });
    return undefined;
  }
  return result.data;
}

router.get("/tenants", (_req, res) => {
  res.json({ tenants });
});

router.get("/tenants/:agency/config", (req, res) => {
  const agency = req.params.agency;
  if (!agency) {
    res.status(400).json({ error: "Invalid agency" });
    return;
  }
  const tenant = tenants.find((item) => item.agency === agency);
  if (!tenant) {
    res.status(404).json({ error: "Tenant not configured" });
    return;
  }
  res.json(tenant);
});

router.post("/auth/officer-login", (req, res) => {
  const input = parseBody(OfficerLoginInputSchema, req, res);
  if (!input) return;

  const officer = officers.find(
    (item) =>
      item.agency === input.agency &&
      item.badgeNumber.toLowerCase() === input.badgeNumber.toLowerCase(),
  );

  if (!officer || officer.pin !== input.pin) {
    audit({
      action: "auth.login_failed",
      entityType: "user",
      entityId: input.badgeNumber,
      metadata: { agency: input.agency },
    });
    res.status(401).json({ error: "Invalid badge number or PIN" });
    return;
  }

  if (!officer.active) {
    res.status(403).json({ error: "Officer account is inactive" });
    return;
  }

  audit({
    tenantId: officer.tenantId,
    actorId: officer.id,
    action: "auth.login",
    entityType: "user",
    entityId: officer.id,
    metadata: {},
  });
  const { pin: _pin, ...safeOfficer } = officer;
  res.json({
    user: safeOfficer,
    token: `dev-token-${officer.id}`,
    tenant: tenants.find((item) => item.id === officer.tenantId),
  });
});

router.post("/citizen-reports", (req, res) => {
  const input = parseBody(CitizenReportInputSchema, req, res);
  if (!input) return;

  const tenant = tenantForAgency(primaryAgencyFor(input.kind));
  const createdAt = now();
  const platformCase: PlatformCase = {
    id: randomUUID(),
    reference: caseReference(input.kind),
    tenantId: tenant.id,
    kind: input.kind,
    status: "new",
    priority: input.priority,
    title: input.title,
    description: input.description,
    location: input.location,
    reporter: input.reporter,
    vehicle: input.vehicle,
    crash: input.crash,
    evidence: input.evidence.map((item) => ({
      ...item,
      id: randomUUID(),
      checksum: item.checksum ?? hashEvidence(`${item.uri}:${createdAt}`),
      capturedAt: item.capturedAt ?? createdAt,
    })),
    timeline: [
      {
        at: createdAt,
        action: "case.created",
        actor: "citizen",
        note: "Submitted from public reporting flow",
      },
    ],
    offlineClientId: input.clientMutationId,
    createdAt,
    updatedAt: createdAt,
  };

  cases.unshift(platformCase);
  audit({
    tenantId: tenant.id,
    action: "case.create",
    entityType: "case",
    entityId: platformCase.id,
    metadata: { source: "citizen", reference: platformCase.reference },
  });

  res
    .status(201)
    .json({
      case: platformCase,
      routedTo: tenant.shortName,
      reference: platformCase.reference,
    });
});

router.get(
  "/cases",
  requireActor,
  requirePermission("case:read"),
  (req: AuthedRequest, res) => {
    const actor = req.actor;
    if (!actor) return;
    const status = req.query.status?.toString();
    const data = visibleCasesFor(actor).filter(
      (item) => !status || item.status === status,
    );
    audit({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action: "case.list",
      entityType: "case",
      entityId: "collection",
      metadata: { count: data.length },
    });
    res.json({ cases: data });
  },
);

router.get(
  "/cases/:id",
  requireActor,
  requirePermission("case:read"),
  (req: AuthedRequest, res) => {
    const actor = req.actor;
    if (!actor) return;
    const item = visibleCasesFor(actor).find(
      (record) =>
        record.id === req.params.id || record.reference === req.params.id,
    );
    if (!item) {
      res.status(404).json({ error: "Case not found or outside tenant scope" });
      return;
    }
    audit({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action: "case.view",
      entityType: "case",
      entityId: item.id,
      metadata: {},
    });
    res.json({
      case: item,
      referrals: referrals.filter((referral) => referral.caseId === item.id),
    });
  },
);

router.post(
  "/cases/:id/assign",
  requireActor,
  requirePermission("case:assign"),
  (req: AuthedRequest, res) => {
    const actor = req.actor;
    if (!actor) return;
    const input = parseBody(AssignCaseInputSchema, req, res);
    if (!input) return;
    const item = visibleCasesFor(actor).find(
      (record) =>
        record.id === req.params.id || record.reference === req.params.id,
    );
    if (!item || item.tenantId !== actor.tenantId) {
      res.status(404).json({ error: "Case not found in your tenant" });
      return;
    }
    const officer = officers.find(
      (record) =>
        record.id === input.officerId && record.tenantId === actor.tenantId,
    );
    if (!officer) {
      res
        .status(400)
        .json({ error: "Assignee must be an active officer in this tenant" });
      return;
    }
    item.assignedTo = officer.id;
    item.status = "assigned";
    item.updatedAt = now();
    item.timeline.unshift({
      at: item.updatedAt,
      action: "case.assigned",
      actor: actor.userId,
      note: input.note ?? `Assigned to ${officer.name}`,
    });
    audit({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action: "case.assign",
      entityType: "case",
      entityId: item.id,
      metadata: { officerId: officer.id },
    });
    res.json({ case: item });
  },
);

router.patch(
  "/cases/:id/status",
  requireActor,
  requirePermission("case:update"),
  (req: AuthedRequest, res) => {
    const actor = req.actor;
    if (!actor) return;
    const input = parseBody(UpdateCaseStatusInputSchema, req, res);
    if (!input) return;
    const item = visibleCasesFor(actor).find(
      (record) =>
        record.id === req.params.id || record.reference === req.params.id,
    );
    if (!item) {
      res.status(404).json({ error: "Case not found or outside tenant scope" });
      return;
    }
    item.status = input.status;
    item.updatedAt = now();
    if (input.status === "closed") item.closedAt = item.updatedAt;
    item.timeline.unshift({
      at: item.updatedAt,
      action: `case.${input.status}`,
      actor: actor.userId,
      note: input.note,
    });
    audit({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action: "case.status_update",
      entityType: "case",
      entityId: item.id,
      metadata: { status: input.status },
    });
    res.json({ case: item });
  },
);

router.post(
  "/cases/:id/referrals",
  requireActor,
  requirePermission("referral:create"),
  (req: AuthedRequest, res) => {
    const actor = req.actor;
    if (!actor) return;
    const input = parseBody(CreateReferralInputSchema, req, res);
    if (!input) return;
    const item = visibleCasesFor(actor).find(
      (record) =>
        record.id === req.params.id || record.reference === req.params.id,
    );
    if (!item || item.tenantId !== actor.tenantId) {
      res.status(404).json({ error: "Case not found in your tenant" });
      return;
    }
    const targetTenant = tenantForAgency(input.toAgency);
    const createdAt = now();
    const referral: Referral = {
      id: randomUUID(),
      caseId: item.id,
      fromTenantId: actor.tenantId,
      toTenantId: targetTenant.id,
      toAgency: input.toAgency,
      reason: input.reason,
      status: "pending",
      note: input.note,
      dueAt: input.dueAt,
      createdAt,
      updatedAt: createdAt,
    };
    referrals.unshift(referral);
    item.status = "referred";
    item.updatedAt = createdAt;
    item.timeline.unshift({
      at: createdAt,
      action: "case.referred",
      actor: actor.userId,
      note: `Referred to ${targetTenant.shortName}: ${input.reason}`,
    });
    audit({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action: "referral.create",
      entityType: "referral",
      entityId: referral.id,
      metadata: { caseId: item.id, toAgency: input.toAgency },
    });
    res.status(201).json({ referral, case: item });
  },
);

router.get(
  "/referrals/inbox",
  requireActor,
  requirePermission("case:read"),
  (req: AuthedRequest, res) => {
    const actor = req.actor;
    if (!actor) return;
    const inbox = referrals.filter(
      (referral) => referral.toTenantId === actor.tenantId,
    );
    res.json({ referrals: inbox });
  },
);

router.post(
  "/duty-sessions",
  requireActor,
  requirePermission("duty:write"),
  (req: AuthedRequest, res) => {
    const actor = req.actor;
    if (!actor) return;
    const input = parseBody(DutySessionInputSchema, req, res);
    if (!input) return;
    if (input.action === "start") {
      const session: DutySession = {
        id: randomUUID(),
        tenantId: actor.tenantId,
        officerId: actor.userId,
        status: "on_duty",
        startedAt: now(),
        startLocation: input.location,
      };
      dutySessions.unshift(session);
      audit({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        action: "duty.start",
        entityType: "duty_session",
        entityId: session.id,
        metadata: { location: input.location },
      });
      res.status(201).json({ session });
      return;
    }

    const active = dutySessions.find(
      (session) =>
        session.officerId === actor.userId && session.status === "on_duty",
    );
    if (!active) {
      res.status(404).json({ error: "No active duty session" });
      return;
    }
    active.status = "off_duty";
    active.endedAt = now();
    active.endLocation = input.location;
    audit({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action: "duty.end",
      entityType: "duty_session",
      entityId: active.id,
      metadata: { location: input.location },
    });
    res.json({ session: active });
  },
);

router.post("/sync/offline", requireActor, (req: AuthedRequest, res) => {
  const actor = req.actor;
  if (!actor) return;
  const input = parseBody(OfflineSyncInputSchema, req, res);
  if (!input) return;

  const results = input.operations.map((operation) => {
    audit({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action: `sync.${operation.operation}`,
      entityType: "sync_operation",
      entityId: operation.clientMutationId,
      metadata: { deviceId: input.deviceId, capturedAt: operation.capturedAt },
    });
    return {
      clientMutationId: operation.clientMutationId,
      status: "accepted" as const,
      serverId: randomUUID(),
    };
  });

  res.json({ results, syncedAt: now() });
});

router.get(
  "/analytics/summary",
  requireActor,
  requirePermission("case:read"),
  (req: AuthedRequest, res) => {
    const actor = req.actor;
    if (!actor) return;
    const data = visibleCasesFor(actor);
    const byStatus = data.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
    const byKind = data.reduce<Record<string, number>>((acc, item) => {
      acc[item.kind] = (acc[item.kind] ?? 0) + 1;
      return acc;
    }, {});
    res.json({
      total: data.length,
      byStatus,
      byKind,
      referrals: referrals.filter((item) => item.toTenantId === actor.tenantId)
        .length,
    });
  },
);

router.get(
  "/audit-logs",
  requireActor,
  requirePermission("audit:read"),
  (req: AuthedRequest, res) => {
    const actor = req.actor;
    if (!actor) return;
    res.json({
      auditLogs: auditLogs
        .filter((item) => item.tenantId === actor.tenantId)
        .slice(0, 100),
    });
  },
);

export default router;
