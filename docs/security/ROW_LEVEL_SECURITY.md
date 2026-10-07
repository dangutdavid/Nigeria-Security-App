# Row-level security (database-enforced tenant isolation)

Tenant isolation is enforced by **Postgres**, not only by the API. Every query
the API runs is executed on a connection stamped with the caller's identity;
policies in migration `lib/db/migrations/0004_row_level_security.sql` decide
which rows that identity can read or write. A missing `WHERE` clause in
application code returns only the caller's own rows — it cannot leak another
agency's data.

## How identity reaches the database

1. `attachAuth` verifies the bearer token (server-signed; client headers are never trusted).
2. `dbContext` middleware checks out one pooled connection per request and sets
   `app.role`, `app.agency`, `app.user_id` with `set_config()`.
3. All queries in that request run on that connection (AsyncLocalStorage).
4. When the response finishes, `DISCARD ALL` wipes the settings before the
   connection returns to the pool — identity can never leak to the next request.

A connection with **no** identity is treated as `anonymous` and sees nothing
(fail closed).

## Access model

| Caller | Citizen reports | Evidence | Notifications | Credentials | Audit trail |
| --- | --- | --- | --- | --- | --- |
| Anonymous citizen | Only the one report whose reference / offline clientId it presents | Only via that report, or one item via a verified signed link | Only its own report's citizen notices | none | append only |
| Officer / supervisor / commander | Own agency only; cannot move a report out of the agency | Inherits the report's visibility | Own agency + own user | own row (read) | append only |
| Admin / super admin | All agencies | All | All | manage | read |
| `system` (server-internal) | All | All | All | All | append; delete only for retention |

Audit tables have **no UPDATE policy** and an immutability **trigger** that
blocks UPDATE/DELETE even for the table owner or a DBA superuser session.

## Privilege boundaries (`runAsSystem`)

Elevation is explicit and greppable (`grep -rn runAsSystem artifacts/api-server/src`):

- Startup seeding (`initAuth`, `initAgencies`)
- Pre-session credential checks: login, OTP lookup, PIN reset after a verified OTP grant

System work uses its own small connection pool (`DATABASE_SYSTEM_POOL_MAX`,
default 5) so it can never deadlock the request pool.

## Database roles — required production setup

| Role | Used by | Properties |
| --- | --- | --- |
| Owner (e.g. `nsa_owner`) | migrations only (`pnpm --filter @workspace/db run migrate`) | owns tables; subject to RLS via `FORCE ROW LEVEL SECURITY` |
| `nsa_app` | the API (`DATABASE_URL`) | created by migration 0004 as `NOLOGIN NOBYPASSRLS`; not owner |

Enable the runtime role once per environment, with a secret-manager password:

```sql
ALTER ROLE nsa_app LOGIN PASSWORD '<from secret manager>';
```

The API **refuses to start in production** if `DATABASE_URL` connects as a
superuser or a `BYPASSRLS` role (`src/lib/dbSafety.ts`), because RLS is
silently skipped for those roles.

Also set `DATABASE_SSL=verify-full` (with `DATABASE_SSL_CA`) in production so
traffic to Postgres is encrypted and the server is authenticated.

## Verification

- `tests/rls-isolation.test.ts` queries tables directly under different
  identities: cross-agency reads return 0 rows, anonymous enumeration returns
  0, officers cannot reassign out of their agency, audit rows cannot be
  altered (RLS + trigger), identity does not leak between pooled connections,
  and the runtime role is not a superuser.
- The whole API suite runs against Postgres as `nsa_app` in CI
  (`pnpm --filter @workspace/api-server test:db`).

Local: `scripts/db/reset-test-db.sh`, then

```sh
TEST_DATABASE_URL=postgres://nsa_app:nsa_app_local_dev@localhost:5432/nsa_test \
TEST_DATABASE_ADMIN_URL=postgres://$(whoami)@localhost:5432/nsa_test \
pnpm --filter @workspace/api-server test:db
```
