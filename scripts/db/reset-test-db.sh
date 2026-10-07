#!/usr/bin/env bash
# Recreate the local database-mode test DB from migrations (owner role), then
# make sure the restricted runtime role can log in.
set -euo pipefail
DB=${TEST_DB_NAME:-nsa_test}
ADMIN_URL=${TEST_DATABASE_ADMIN_URL:-postgres://$(whoami)@localhost:5432/$DB}
dropdb -h localhost --if-exists "$DB" >/dev/null
createdb -h localhost "$DB"
DATABASE_URL="$ADMIN_URL" pnpm --filter @workspace/db run migrate >/dev/null
psql -h localhost -d "$DB" -qc "ALTER ROLE nsa_app LOGIN PASSWORD '${NSA_APP_TEST_PASSWORD:-nsa_app_local_dev}'"
echo "test database $DB recreated"
