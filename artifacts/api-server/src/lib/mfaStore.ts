import { eq } from "drizzle-orm";
import { authMfa, getDb, isDbConfigured, type Database } from "@workspace/db";
import { logger } from "./logger";

/** Per-user second-factor state. Secrets/phones are already encrypted here. */
export interface MfaRecord {
  userId: string;
  totpSecretEnc: string | null;
  totpPendingSecretEnc: string | null;
  totpEnabled: boolean;
  totpLastStep: number | null;
  smsPhoneEnc: string | null;
  smsPendingPhoneEnc: string | null;
  smsEnabled: boolean;
  recoveryCodeHashes: string[];
  enrolledAt: Date | null;
}

export type MfaPatch = Partial<Omit<MfaRecord, "userId">>;

export interface MfaStore {
  get(userId: string): Promise<MfaRecord | null>;
  upsert(userId: string, patch: MfaPatch): Promise<MfaRecord>;
  clear(userId: string): Promise<void>;
}

function empty(userId: string): MfaRecord {
  return {
    userId, totpSecretEnc: null, totpPendingSecretEnc: null, totpEnabled: false, totpLastStep: null,
    smsPhoneEnc: null, smsPendingPhoneEnc: null, smsEnabled: false, recoveryCodeHashes: [], enrolledAt: null,
  };
}

class InMemoryMfaStore implements MfaStore {
  private readonly rows = new Map<string, MfaRecord>();
  async get(userId: string) {
    return this.rows.get(userId) ?? null;
  }
  async upsert(userId: string, patch: MfaPatch) {
    const next = { ...(this.rows.get(userId) ?? empty(userId)), ...patch };
    this.rows.set(userId, next);
    return next;
  }
  async clear(userId: string) {
    this.rows.delete(userId);
  }
}

class DrizzleMfaStore implements MfaStore {
  constructor(private readonly db: Database) {}
  async get(userId: string) {
    const [row] = await this.db.select().from(authMfa).where(eq(authMfa.userId, userId)).limit(1);
    return row ? { ...row, recoveryCodeHashes: row.recoveryCodeHashes ?? [] } : null;
  }
  async upsert(userId: string, patch: MfaPatch) {
    const values = { ...empty(userId), ...(await this.get(userId)), ...patch, userId, updatedAt: new Date() };
    await this.db
      .insert(authMfa)
      .values(values)
      .onConflictDoUpdate({ target: authMfa.userId, set: { ...patch, updatedAt: new Date() } });
    return values;
  }
  async clear(userId: string) {
    await this.db.delete(authMfa).where(eq(authMfa.userId, userId));
  }
}

function createMfaStore(): MfaStore {
  const db = getDb();
  if (db && isDbConfigured()) return new DrizzleMfaStore(db);
  logger.warn("MFA store: in-memory fallback (set DATABASE_URL to persist enrolments)");
  return new InMemoryMfaStore();
}

export const mfaStore: MfaStore = createMfaStore();
