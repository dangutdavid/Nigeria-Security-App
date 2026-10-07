#!/usr/bin/env bash
# Quarterly restore drill (and real recovery). Run on a SEPARATE machine that
# holds the offline age private key:
#   ./restore-test.sh <backup-file.dump.age> <age-identity-file>
# Restores into a throwaway Postgres container and runs sanity checks.
set -euo pipefail
BACKUP=${1:?backup file}
IDENTITY=${2:?age identity (private key) file}
NAME=nsa-restore-test-$$
age -d -i "$IDENTITY" "$BACKUP" > /tmp/$NAME.dump
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=restore -e POSTGRES_DB=nsa postgres:16-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1; rm -f /tmp/$NAME.dump' EXIT
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
docker exec "$NAME" psql -U postgres -qc "CREATE ROLE nsa_app NOLOGIN NOBYPASSRLS" || true
docker exec -i "$NAME" pg_restore -U postgres -d nsa --no-owner < /tmp/$NAME.dump
echo "== restored. sanity checks:"
docker exec "$NAME" psql -U postgres -d nsa -Atc "select 'citizen_reports: ' || count(*) from citizen_reports"
docker exec "$NAME" psql -U postgres -d nsa -Atc "select 'audit_events: ' || count(*) from audit_events"
docker exec "$NAME" psql -U postgres -d nsa -Atc "select 'tables with forced RLS: ' || count(*) from pg_class where relforcerowsecurity"
echo "Record the date, backup name and these counts in the restore log (RUNBOOK §2)."
