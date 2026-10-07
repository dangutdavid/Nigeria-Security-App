import { getPool, isDbConfigured } from "@workspace/db";
import { logger } from "./logger";

/**
 * Row-level security is silently skipped for superusers and BYPASSRLS roles.
 * If the API were (mis)configured to connect as one, every isolation policy
 * would turn off with no visible symptom — so check on boot. Production
 * refuses to start; development warns loudly (local Postgres superusers are
 * common there).
 */
export async function assertDatabaseRoleEnforcesRls(): Promise<void> {
  if (!isDbConfigured()) return;
  const pool = getPool();
  if (!pool) return;
  const { rows } = await pool.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
    "select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user",
  );
  const role = rows[0];
  if (!role) return;
  if (role.rolsuper || role.rolbypassrls) {
    const message =
      `Database role "${role.rolname}" bypasses row-level security (superuser/BYPASSRLS). ` +
      "Connect the API as the restricted runtime role (nsa_app) — see docs/security/ROW_LEVEL_SECURITY.md.";
    if (process.env.NODE_ENV === "production") throw new Error(message);
    logger.warn(message + " Tenant isolation is NOT enforced by the database in this process.");
    return;
  }
  logger.info({ role: role.rolname }, "Database role enforces row-level security");
}
