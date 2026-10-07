import pg from "pg";

/**
 * Runs once per database-mode test run, before any file: wipe all app data so
 * results never depend on a previous run. Uses the ADMIN url (table owner) —
 * the app role deliberately has no TRUNCATE privilege.
 */
export default async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_ADMIN_URL ?? process.env.TEST_DATABASE_URL;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'",
    );
    if (rows.length > 0) {
      const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
      await client.query(`truncate ${list} restart identity cascade`);
    }
  } finally {
    await client.end();
  }
}
