import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export type Database = NodePgDatabase<typeof schema>;

let cachedPool: pg.Pool | null = null;
let cachedDb: Database | null = null;

/** True when a DATABASE_URL is configured (Postgres mode available). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Lazily construct (and cache) the Drizzle client. Returns null when no
 * DATABASE_URL is set, so callers can fall back to in-memory storage instead of
 * crashing local/demo development. Importing this module no longer throws.
 */
export function getDb(): Database | null {
  if (!process.env.DATABASE_URL) return null;
  if (!cachedDb) {
    cachedPool = new Pool({ connectionString: process.env.DATABASE_URL });
    cachedDb = drizzle(cachedPool, { schema });
  }
  return cachedDb;
}

export function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!cachedPool) getDb();
  return cachedPool;
}

export * from "./schema";
