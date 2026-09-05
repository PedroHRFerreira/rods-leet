#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DATABASE_URL:?Configure the database backup connection}"
: "${BACKUP_AGE_RECIPIENT:?Configure the offline age public recipient}"
: "${BACKUP_S3_URI:?Configure an existing offsite S3 destination}"
[[ "$BACKUP_S3_URI" == s3://* ]] || { echo 'Only an existing S3 destination is supported.' >&2; exit 1; }
for executable in pg_dump age aws; do command -v "$executable" >/dev/null; done
backup_directory=$(mktemp -d)
trap 'rm -rf "$backup_directory"' EXIT
backup_name="codegamer-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
# Stream the dump directly into encryption: no plaintext dump is stored on disk.
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges |
  age --recipient "$BACKUP_AGE_RECIPIENT" --output "$backup_directory/$backup_name"
sha256sum "$backup_directory/$backup_name" > "$backup_directory/$backup_name.sha256"
aws s3 cp "$backup_directory/$backup_name" "$BACKUP_S3_URI/$backup_name" --only-show-errors
aws s3 cp "$backup_directory/$backup_name.sha256" "$BACKUP_S3_URI/$backup_name.sha256" --only-show-errors
printf 'Encrypted backup uploaded: %s\n' "$backup_name"
