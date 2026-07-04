import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, agencies } from "@workspace/db";
import { logger } from "./logger";

export interface AgencyRecord {
  id: string;
  name: string;
  shortName: string;
  fullName: string;
  primaryColor: string;
  secondaryColor: string;
  badgePrefix: string;
  description: string;
  icon?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgencyCreateInput {
  id?: string;
  name: string;
  shortName: string;
  fullName: string;
  primaryColor: string;
  secondaryColor: string;
  badgePrefix: string;
  description: string;
  icon?: string;
  isActive?: boolean;
}

export interface AgencyUpdateInput {
  name?: string;
  shortName?: string;
  fullName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  badgePrefix?: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
}

/** Built-in agencies mirroring the mobile DEFAULT_AGENCIES registry. */
export const BUILT_IN_AGENCIES: AgencyRecord[] = [
  { id: "frsc", name: "FRSC", shortName: "FRSC", fullName: "Federal Road Safety Corps", primaryColor: "#1B5E3B", secondaryColor: "#2E7D52", badgePrefix: "FO/SV/CMD", description: "Road traffic management, crash response & safety enforcement", icon: "shield", isActive: true },
  { id: "police", name: "Nigeria Police", shortName: "NPF", fullName: "Nigeria Police Force", primaryColor: "#1A3A6C", secondaryColor: "#254E9C", badgePrefix: "NPF", description: "Crime investigation, law enforcement & public security", icon: "star", isActive: true },
  { id: "vio", name: "VIO", shortName: "VIO", fullName: "Vehicle Inspection Officers", primaryColor: "#7B3F00", secondaryColor: "#A0522D", badgePrefix: "VIO", description: "Vehicle roadworthiness inspection & certification", icon: "clipboard", isActive: true },
  { id: "civil_defence", name: "Civil Defence", shortName: "NSCDC", fullName: "Nigeria Security and Civil Defence Corps", primaryColor: "#234E2A", secondaryColor: "#3F7D3A", badgePrefix: "NSCDC", description: "Civil protection, rescue support & infrastructure security", icon: "shield", isActive: true },
  { id: "admin", name: "Admin", shortName: "ADMIN", fullName: "Security Platform Administration", primaryColor: "#344054", secondaryColor: "#667085", badgePrefix: "ADMIN", description: "Cross-agency oversight, users & system operations", icon: "settings", isActive: true },
];

export function slugifyAgencyId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/**
 * Persistence boundary for the agency registry. DB-backed when DATABASE_URL is
 * set, else in-memory (explicit local-dev fallback seeded with the built-ins).
 */
export interface AgencyStore {
  list(includeInactive?: boolean): Promise<AgencyRecord[]>;
  findById(id: string): Promise<AgencyRecord | undefined>;
  create(input: AgencyCreateInput): Promise<AgencyRecord>;
  update(id: string, patch: AgencyUpdateInput): Promise<AgencyRecord | undefined>;
  /** Idempotently seed the built-in agencies. */
  seedDefaults(): Promise<void>;
}

function nowIso(): string {
  return new Date().toISOString();
}

class InMemoryAgencyStore implements AgencyStore {
  private readonly records: AgencyRecord[] = BUILT_IN_AGENCIES.map((a) => ({ ...a }));

  async list(includeInactive = false): Promise<AgencyRecord[]> {
    return this.records.filter((a) => includeInactive || a.isActive);
  }

  async findById(id: string): Promise<AgencyRecord | undefined> {
    return this.records.find((a) => a.id === id.toLowerCase());
  }

  async create(input: AgencyCreateInput): Promise<AgencyRecord> {
    const id = (input.id ?? slugifyAgencyId(input.name)).toLowerCase();
    if (this.records.some((a) => a.id === id)) {
      throw new AgencyConflictError(id);
    }
    const record: AgencyRecord = {
      ...input,
      id,
      icon: input.icon ?? "shield",
      isActive: input.isActive ?? true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.records.push(record);
    return record;
  }

  async update(id: string, patch: AgencyUpdateInput): Promise<AgencyRecord | undefined> {
    const record = this.records.find((a) => a.id === id.toLowerCase());
    if (!record) return undefined;
    Object.assign(record, stripUndefined(patch), { updatedAt: nowIso() });
    return record;
  }

  async seedDefaults(): Promise<void> {
    // Constructor already seeds the built-ins.
  }
}

export class AgencyConflictError extends Error {
  constructor(id: string) {
    super(`Agency "${id}" already exists`);
    this.name = "AgencyConflictError";
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

type AgencyRow = typeof agencies.$inferSelect;

function rowToRecord(row: AgencyRow): AgencyRecord {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    fullName: row.fullName,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    badgePrefix: row.badgePrefix,
    description: row.description,
    icon: row.icon,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

class DbAgencyStore implements AgencyStore {
  constructor(private readonly db: NonNullable<ReturnType<typeof getDb>>) {}

  async list(includeInactive = false): Promise<AgencyRecord[]> {
    const rows = await this.db.select().from(agencies).orderBy(agencies.createdAt);
    return rows.map(rowToRecord).filter((a) => includeInactive || a.isActive);
  }

  async findById(id: string): Promise<AgencyRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(agencies)
      .where(eq(agencies.id, id.toLowerCase()))
      .limit(1);
    return row ? rowToRecord(row) : undefined;
  }

  async create(input: AgencyCreateInput): Promise<AgencyRecord> {
    const id = (input.id ?? slugifyAgencyId(input.name)).toLowerCase();
    if (await this.findById(id)) throw new AgencyConflictError(id);
    const [row] = await this.db
      .insert(agencies)
      .values({
        id,
        name: input.name,
        shortName: input.shortName,
        fullName: input.fullName,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        badgePrefix: input.badgePrefix,
        description: input.description,
        icon: input.icon ?? "shield",
        isActive: input.isActive ?? true,
      })
      .returning();
    return rowToRecord(row);
  }

  async update(id: string, patch: AgencyUpdateInput): Promise<AgencyRecord | undefined> {
    const [row] = await this.db
      .update(agencies)
      .set({ ...stripUndefined(patch), updatedAt: new Date() })
      .where(eq(agencies.id, id.toLowerCase()))
      .returning();
    return row ? rowToRecord(row) : undefined;
  }

  async seedDefaults(): Promise<void> {
    let created = 0;
    for (const agency of BUILT_IN_AGENCIES) {
      const inserted = await this.db
        .insert(agencies)
        .values({
          id: agency.id,
          name: agency.name,
          shortName: agency.shortName,
          fullName: agency.fullName,
          primaryColor: agency.primaryColor,
          secondaryColor: agency.secondaryColor,
          badgePrefix: agency.badgePrefix,
          description: agency.description,
          icon: agency.icon ?? "shield",
          isActive: agency.isActive,
        })
        .onConflictDoNothing({ target: agencies.id })
        .returning();
      if (inserted.length > 0) created += 1;
    }
    logger.info(
      { created, total: BUILT_IN_AGENCIES.length },
      created > 0 ? "Seeded built-in agencies" : "Built-in agencies already present",
    );
  }
}

function createAgencyStore(): AgencyStore {
  const db = getDb();
  if (db && isDbConfigured()) {
    logger.info("Agency store: PostgreSQL (Drizzle)");
    return new DbAgencyStore(db);
  }
  logger.warn("Agency store: in-memory fallback (set DATABASE_URL to enable Postgres)");
  return new InMemoryAgencyStore();
}

export const agencyStore: AgencyStore = createAgencyStore();

export async function initAgencies(): Promise<void> {
  try {
    await agencyStore.seedDefaults();
  } catch (err) {
    logger.error({ err }, "Agency seeding failed");
  }
}
