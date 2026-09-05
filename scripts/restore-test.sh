#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${LOCAL_TEST_DATABASE_URL:?Use an empty local Supabase database for restore rehearsal}"
: "${BACKUP_AGE_IDENTITY_FILE:?Path to the offline decryption identity}"
[[ "$LOCAL_TEST_DATABASE_URL" =~ @((127\.0\.0\.1)|(localhost))[:/] ]] || { echo 'Restore rehearsal is restricted to localhost.' >&2; exit 1; }
[[ $# -eq 1 && -f "$1" ]] || { echo 'Usage: restore-test.sh encrypted-backup.dump.age' >&2; exit 1; }
age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" "$1" |
  pg_restore --dbname "$LOCAL_TEST_DATABASE_URL" --clean --if-exists --exit-on-error --no-owner --no-privileges
psql "$LOCAL_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'select count(*) as profiles from public.profiles; select count(*) as submissions from public.submissions;'
