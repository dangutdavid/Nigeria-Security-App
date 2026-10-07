import { AsyncLocalStorage } from "node:async_hooks";
import type pg from "pg";

/**
 * Database security context (row-level security).
 *
 * Every query the API runs carries WHO is asking, as Postgres session settings
 * (app.role / app.agency / app.user_id). RLS policies in the database read
 * those settings, so tenant isolation is enforced by Postgres itself — a
 * forgotten WHERE clause in application code returns zero rows instead of
 * another agency's data.
 *
 * Mechanics: a request checks out ONE pooled connection, stamps the context on
 * it with set_config(), runs all of its queries on that connection (via
 * AsyncLocalStorage), then DISCARD ALL wipes the settings before the
 * connection returns to the pool, so context can never leak between requests.
 */
export type DbRole =
  | "anonymous"
  | "citizen"
  | "officer"
  | "supervisor"
  | "commander"
  | "admin"
  | "super_admin"
  | "system";

export interface DbSecurityContext {
  role: DbRole;
  agency?: string | null;
  userId?: string | null;
}

export interface ScopedConnection {
  client: pg.PoolClient;
  context: DbSecurityContext;
}

export const dbContextStorage = new AsyncLocalStorage<ScopedConnection>();

export function currentDbContext(): DbSecurityContext | undefined {
  return dbContextStorage.getStore()?.context;
}

const KNOWN_LOOKUPS = new Set(["reference", "client_id", "evidence_id"]);

export async function applyContext(client: pg.PoolClient, context: DbSecurityContext): Promise<void> {
  await client.query(
    "select set_config('app.role', $1, false), set_config('app.agency', $2, false), set_config('app.user_id', $3, false)",
    [context.role, (context.agency ?? "").toLowerCase(), context.userId ?? ""],
  );
}

/**
 * Narrow, single-row grant for anonymous citizen flows. An unauthenticated
 * caller may only ever read the one report whose reference (or offline
 * clientId) it already holds — RLS checks the row against this value, so a
 * citizen can't enumerate other people's reports even via a code bug.
 * Must be called inside an active context.
 */
export async function setScopedLookup(kind: "reference" | "client_id" | "evidence_id", value: string): Promise<void> {
  if (!KNOWN_LOOKUPS.has(kind)) throw new Error(`Unknown scoped lookup ${kind}`);
  const scoped = dbContextStorage.getStore();
  if (!scoped) return; // in-memory mode / no DB context: nothing to scope
  await scoped.client.query("select set_config($1, $2, false)", [`app.lookup_${kind}`, value]);
}
