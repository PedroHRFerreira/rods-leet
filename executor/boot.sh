#!/usr/bin/env bash
set -euo pipefail
mkdir -p /run/codegamer /run/postgresql
chown postgres:postgres /run/postgresql
chmod 700 /run/codegamer /run/postgresql
[[ -e /sys/fs/cgroup/cgroup.controllers ]] || { echo 'cgroup v2 required' >&2; exit 1; }
# The template must delegate this subtree. Failure keeps the executor unavailable.
mkdir -p /sys/fs/cgroup/codegamer
printf '+cpu +memory +pids' > /sys/fs/cgroup/codegamer/cgroup.subtree_control
mkdir -p /sys/fs/cgroup/codegamer-postgres
printf '536870912' > /sys/fs/cgroup/codegamer-postgres/memory.max
printf '0' > /sys/fs/cgroup/codegamer-postgres/memory.swap.max
printf '16' > /sys/fs/cgroup/codegamer-postgres/pids.max
(
 printf '%s' "$BASHPID" > /sys/fs/cgroup/codegamer-postgres/cgroup.procs
 exec /usr/sbin/runuser -u postgres -- /opt/postgres/bin/postgres -D /var/lib/codegamer-pg
) &
for attempt in $(seq 1 50); do
 /opt/postgres/bin/pg_isready -h /run/postgresql -U root -d codegamer >/dev/null 2>&1 && break
 sleep 0.1
done
/opt/postgres/bin/pg_isready -h /run/postgresql -U root -d codegamer >/dev/null
touch /run/codegamer/ready
wait
