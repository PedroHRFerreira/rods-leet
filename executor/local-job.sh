#!/usr/bin/env bash
set -euo pipefail
umask 077
mkdir -p /workspace /workspace/tmp /run/codegamer /run/postgresql
cp -R /opt/codegamer/postgres-seed/. /var/lib/codegamer-pg/
cp -R /job/files/. /workspace/
cp /job/request.json /run/codegamer/request.json
chown -R student:student /workspace
chmod -R u=rwX,go=rX /workspace
chmod 711 /run/postgresql
chmod 700 /run/codegamer
chmod 700 /var/lib/codegamer-pg
chown postgres:postgres /run/postgresql
chown -R postgres:postgres /var/lib/codegamer-pg
/usr/sbin/runuser -u postgres -- /opt/postgres/bin/postgres -D /var/lib/codegamer-pg >/run/codegamer/postgres.log 2>&1 &
postgres_pid=$!
cleanup() { kill "$postgres_pid" 2>/dev/null || true; }
trap cleanup EXIT
for _ in $(seq 1 50); do
  /opt/postgres/bin/pg_isready -h /run/postgresql -U root -d codegamer >/dev/null 2>&1 && break
  sleep 0.1
done
/opt/postgres/bin/pg_isready -h /run/postgresql -U root -d codegamer >/dev/null || {
  tail -n 10 /run/codegamer/postgres.log >&2
  exit 1
}
EXECUTION_CGROUP_MODE=container /opt/python/bin/python3 -I /opt/codegamer/supervisor.py || true
test -s /run/codegamer/result.json
