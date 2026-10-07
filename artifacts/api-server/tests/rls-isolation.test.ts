import { describe, expect, it } from "vitest";
import pg from "pg";
import { sql } from "drizzle-orm";
import { citizenReports, getDb, runAsSystem, withDbContext, auditEvents } from "@workspace/db";

/**
 * Proves isolation is enforced by POSTGRES, not the API: these tests bypass
 * every route/store and query the tables directly under different caller
 * identities. Database-mode only (pnpm test:db); skipped in the in-memory run.
 */
const dbMode = Boolean(process.env.DATABASE_URL);

/** Drizzle wraps the Postgres error; the policy message is on the cause. */
async function rejectionText(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "resolved";
  } catch (err) {
    const e = err as Error & { cause?: { message?: string } };
    return `${e.message} ${e.cause?.message ?? ""}`;
  }
}

async function seedReport(agency: string, reference: string): Promise<void> {
  await runAsSystem(async () => {
    await getDb()!.insert(citizenReports).values({
      reference, incidentType: "road_crash", description: "rls isolation fixture",
      emergencyLevel: "low", suggestedAgency: agency as never, status: "submitted",
      location: "Fixture Rd", address: "Fixture Rd", locationSource: "manual", timeline: [],
    }).onConflictDoNothing();
  });
}

function countReports(where = sql`true`) {
  return getDb()!.select({ n: sql<number>`count(*)::int` }).from(citizenReports).where(where).then((r) => r[0]!.n);
}

describe.skipIf(!dbMode)("Postgres row-level security", () => {
  it("the runtime role cannot bypass RLS (not superuser, no BYPASSRLS)", async () => {
    const rows = await getDb()!.execute(sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`);
    const r = rows.rows[0] as { rolsuper: boolean; rolbypassrls: boolean };
    expect(r.rolsuper).toBe(false);
    expect(r.rolbypassrls).toBe(false);
  });

  it("an agency sees only its own reports, even with no WHERE clause", async () => {
    await seedReport("frsc", "CIR-RLS-FRSC-0001");
    await seedReport("police", "CIR-RLS-POL-0001");
    const frscSeesPolice = await withDbContext({ role: "officer", agency: "frsc", userId: "u-frsc" },
      () => countReports(sql`${citizenReports.reference} = 'CIR-RLS-POL-0001'`));
    const policeSeesPolice = await withDbContext({ role: "officer", agency: "police", userId: "u-pol" },
      () => countReports(sql`${citizenReports.reference} = 'CIR-RLS-POL-0001'`));
    expect(frscSeesPolice).toBe(0);
    expect(policeSeesPolice).toBe(1);
  });

  it("an officer cannot move a report out of their agency (reassignment is admin-only)", async () => {
    await seedReport("frsc", "CIR-RLS-FRSC-0002");
    const attempt = withDbContext({ role: "officer", agency: "frsc", userId: "u-frsc" }, () =>
      getDb()!.update(citizenReports).set({ assignedAgency: "police" })
        .where(sql`${citizenReports.reference} = 'CIR-RLS-FRSC-0002'`));
    expect(await rejectionText(attempt)).toMatch(/row-level security/);
  });

  it("an anonymous caller cannot enumerate reports", async () => {
    await seedReport("frsc", "CIR-RLS-FRSC-0003");
    const visible = await withDbContext({ role: "anonymous" }, () => countReports());
    expect(visible).toBe(0);
  });

  it("an admin sees across agencies", async () => {
    const visible = await withDbContext({ role: "admin", agency: "admin", userId: "u-admin" },
      () => countReports(sql`${citizenReports.reference} like 'CIR-RLS-%'`));
    expect(visible).toBeGreaterThanOrEqual(2);
  });

  it("a connection with no identity sees nothing (fail closed)", async () => {
    // Base pool connection, no context stamped: treated as anonymous.
    expect(await countReports()).toBe(0);
  });

  it("audit records cannot be altered by the app, even as system", async () => {
    await runAsSystem(async () => {
      await getDb()!.insert(auditEvents).values({ type: "system", title: "immutability probe", detail: "rls test" });
    });
    // Layer 1 — RLS: there is no UPDATE policy on audit tables, so the app
    // role's update matches zero rows.
    await runAsSystem(() =>
      getDb()!.update(auditEvents).set({ title: "tampered" }).where(sql`${auditEvents.title} = 'immutability probe'`));
    const titles = await runAsSystem(() =>
      getDb()!.select({ t: auditEvents.title }).from(auditEvents).where(sql`${auditEvents.detail} = 'rls test'`));
    expect(titles.map((r) => r.t)).not.toContain("tampered");
  });

  it("audit records are immutable even for a database superuser (trigger)", async () => {
    // Layer 2 — trigger: fires regardless of role, so even a DBA session or a
    // misconfigured superuser connection cannot rewrite history.
    const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_ADMIN_URL ?? process.env.DATABASE_URL });
    await admin.connect();
    try {
      const attempt = admin.query("update public.audit_events set title = 'tampered' where detail = 'rls test'");
      await expect(attempt).rejects.toThrow(/immutable/);
    } finally {
      await admin.end();
    }
  });

  it("identity never leaks between pooled connections", async () => {
    await withDbContext({ role: "admin", agency: "admin", userId: "u-admin" }, async () => undefined);
    // Next anonymous unit of work may reuse that same physical connection.
    expect(await withDbContext({ role: "anonymous" }, () => countReports())).toBe(0);
  });
});
