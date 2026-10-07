#!/usr/bin/env bash
# Nightly encrypted off-site Postgres backup (systemd: nsa-backup.timer).
# Encrypts with `age` to a recovery PUBLIC key; the private key is kept offline,
# so a compromised server cannot read old backups. Recovery: restore-test.sh.
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./secrets/backup.env; . ./secrets/postgres.env; set +a
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="nsa-${STAMP}.dump.age"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner \
  | age -r "$BACKUP_AGE_RECIPIENT" > "$TMP/$FILE"
sha256sum "$TMP/$FILE" | awk '{print $1}' > "$TMP/$FILE.sha256"

aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$TMP/$FILE" "$BACKUP_S3_URI/$FILE" --only-show-errors
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$TMP/$FILE.sha256" "$BACKUP_S3_URI/$FILE.sha256" --only-show-errors

# Prune off-site copies older than BACKUP_KEEP_DAYS.
CUTOFF=$(date -u -d "-${BACKUP_KEEP_DAYS:-35} days" +%Y%m%d)
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 ls "$BACKUP_S3_URI/" | awk '{print $4}' | while read -r name; do
  day=$(echo "$name" | sed -n 's/^nsa-\([0-9]\{8\}\).*/\1/p')
  [ -n "$day" ] && [ "$day" -lt "$CUTOFF" ] && aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 rm "$BACKUP_S3_URI/$name" --only-show-errors
done
echo "backup ok: $FILE"
