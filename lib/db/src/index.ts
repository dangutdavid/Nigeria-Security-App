import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { applyContext, dbContextStorage, type DbSecurityContext, type ScopedConnection } from "./context";

const { Pool } = pg;

export type Database = NodePgDatabase<typeof schema>;

let cachedPool: pg.Pool | null = null;
// Elevated ('system') work gets its own small pool. A request holds one
// connection from the main pool; if its system call drew from the same pool,
// a burst of such requests could exhaust it and deadlock (each waiting for a
// second connection). Separate pools make that circular wait impossible.
let systemPool: pg.Pool | null = null;
let baseDb: Database | null = null;
let contextAwareDb: Database | null = null;
const scopedDbs = new WeakMap<ScopedConnection, Database>();

/** True when a DATABASE_URL is configured (Postgres mode available). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function sslOption(): pg.PoolConfig["ssl"] {
  // Encrypt in transit (HIPAA §164.312(e), GDPR Art. 32). DATABASE_SSL=require
  // verifies nothing but encrypts; =verify-full also checks the server cert.
  const mode = process.env.DATABASE_SSL;
  if (mode === "require") return { rejectUnauthorized: false };
  if (mode === "verify-full") return { rejectUnauthorized: true, ca: process.env.DATABASE_SSL_CA };
  return undefined;
}

function ensurePool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!cachedPool) {
    cachedPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslOption(),
      max: Number(process.env.DATABASE_POOL_MAX ?? 20),
    });
    baseDb = drizzle(cachedPool, { schema });
  }
  return cachedPool;
}

function resolveDb(): Database {
  const scoped = dbContextStorage.getStore();
  if (!scoped) return baseDb!;
  let db = scopedDbs.get(scoped);
  if (!db) {
    db = drizzle(scoped.client, { schema }) as unknown as Database;
    scopedDbs.set(scoped, db);
  }
  return db;
}

/**
 * The Drizzle client. Returns null when no DATABASE_URL is set (callers fall
 * back to in-memory storage). The returned object is context-aware: inside
 * withDbContext() every call is routed to that request's connection, which
 * carries the caller's RLS identity — so stores that captured this object at
 * construction still execute as the current caller.
 */
export function getDb(): Database | null {
  if (!ensurePool()) return null;
  if (!contextAwareDb) {
    contextAwareDb = new Proxy({} as Database, {
      get(_target, prop) {
        const real = resolveDb() as unknown as Record<PropertyKey, unknown>;
        const value = Reflect.get(real, prop, real);
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
      },
    });
  }
  return contextAwareDb;
}

export function getPool(): pg.Pool | null {
  return ensurePool();
}

/**
 * Run fn on a dedicated connection stamped with the given security context.
 * The settings are wiped (DISCARD ALL) before the connection is returned, so
 * one caller's identity can never leak into the next caller's queries.
 */
function ensureSystemPool(): pg.Pool | null {
  if (!ensurePool()) return null;
  if (!systemPool) {
    systemPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslOption(),
      max: Number(process.env.DATABASE_SYSTEM_POOL_MAX ?? 5),
    });
  }
  return systemPool;
}

export async function withDbContext<T>(context: DbSecurityContext, fn: () => Promise<T>): Promise<T> {
  const pool = context.role === "system" ? ensureSystemPool() : ensurePool();
  if (!pool) return fn();
  const client = await pool.connect();
  let broken = false;
  try {
    await applyContext(client, context);
    return await dbContextStorage.run({ client, context }, fn);
  } finally {
    try {
      await client.query("DISCARD ALL");
    } catch {
      broken = true; // e.g. aborted transaction left open — never reuse it
    }
    client.release(broken);
  }
}

/**
 * Elevated context for trusted server work with no end-user caller: startup
 * seeding, credential verification before a session exists, and similar.
 * Every call site is an explicit, greppable privilege boundary.
 */
export function runAsSystem<T>(fn: () => Promise<T>): Promise<T> {
  return withDbContext({ role: "system" }, fn);
}

export { currentDbContext, setScopedLookup, type DbRole, type DbSecurityContext } from "./context";
export * from "./schema";
