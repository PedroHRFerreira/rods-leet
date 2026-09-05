#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
# Snapshot fixes Debian package resolution. Template itself is pinned by digest.
rm -f /etc/apt/sources.list.d/debian.sources
printf '%s\n' 'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/20260901T000000Z bookworm main' > /etc/apt/sources.list
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl xz-utils unzip bzip2 build-essential python3 python3-pip python3-venv openjdk-17-jdk-headless libcjson-dev nlohmann-json3-dev libicu72 libssl-dev zlib1g-dev libreadline-dev pkg-config
mkdir -p /opt/codegamer /opt/libs /opt/kotlin-libs /opt/dotnet /opt/cargo
curl -fsSLo /tmp/rust.tar.xz https://static.rust-lang.org/dist/rust-1.85.0-x86_64-unknown-linux-gnu.tar.xz
tar -xf /tmp/rust.tar.xz -C /tmp
bash /tmp/rust-1.85.0-x86_64-unknown-linux-gnu/install.sh --prefix=/usr/local --components=rustc,cargo,rust-std-x86_64-unknown-linux-gnu --disable-ldconfig
curl -fsSLo /tmp/node.tar.xz https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz
curl -fsSLo /tmp/node-sha https://nodejs.org/dist/v22.14.0/SHASUMS256.txt
node_sha=$(awk '$2=="node-v22.14.0-linux-x64.tar.xz" {print $1}' /tmp/node-sha)
printf '%s  /tmp/node.tar.xz\n' "$node_sha" | sha256sum -c -
tar -xf /tmp/node.tar.xz -C /usr/local --strip-components=1
npm install --global typescript@5.9.3
curl -fsSLo /tmp/go.tar.gz https://go.dev/dl/go1.23.7.linux-amd64.tar.gz
tar -xzf /tmp/go.tar.gz -C /opt
curl -fsSLo /tmp/dotnet.tar.gz https://builds.dotnet.microsoft.com/dotnet/Sdk/8.0.407/dotnet-sdk-8.0.407-linux-x64.tar.gz
tar -xzf /tmp/dotnet.tar.gz -C /opt/dotnet
curl -fsSLo /tmp/kotlin.zip https://github.com/JetBrains/kotlin/releases/download/v2.1.10/kotlin-compiler-2.1.10.zip
unzip -q /tmp/kotlin.zip -d /opt
mv /opt/kotlinc /opt/kotlin
for artifact in jackson-annotations jackson-core jackson-databind; do
 curl -fsSLo "/opt/libs/$artifact.jar" "https://repo.maven.apache.org/maven2/com/fasterxml/jackson/core/$artifact/2.18.3/$artifact-2.18.3.jar"
done
for artifact in kotlinx-serialization-core-jvm kotlinx-serialization-json-jvm; do
 curl -fsSLo "/opt/kotlin-libs/$artifact.jar" "https://repo.maven.apache.org/maven2/org/jetbrains/kotlinx/$artifact/1.8.0/$artifact-1.8.0.jar"
done
python3 -m venv /opt/python
/opt/python/bin/pip install --no-cache-dir -r /tmp/requirements.txt
ln -sf /opt/python/bin/python3 /usr/local/bin/python3
# Resolve Rust dependencies once at build time and preserve Cargo.lock for audit.
mkdir /tmp/rust-seed
printf '%s\n' '[package]' 'name="seed"' 'version="0.1.0"' 'edition="2021"' '[dependencies]' 'serde_json="=1.0.140"' > /tmp/rust-seed/Cargo.toml
mkdir /tmp/rust-seed/src
printf '%s\n' 'fn main(){}' > /tmp/rust-seed/src/main.rs
CARGO_HOME=/opt/cargo cargo fetch --manifest-path /tmp/rust-seed/Cargo.toml
cp /tmp/rust-seed/Cargo.lock /opt/codegamer/dependencies.Cargo.lock
# SQL runtime is separate from the application's Supabase database.
curl -fsSLo /tmp/pg.tar.bz2 https://ftp.postgresql.org/pub/source/v18.4/postgresql-18.4.tar.bz2
tar -xjf /tmp/pg.tar.bz2 -C /tmp
cd /tmp/postgresql-18.4
./configure --prefix=/opt/postgres --without-icu --without-readline --without-zlib
make -j2
make install
useradd --uid 12001 --no-create-home --shell /usr/sbin/nologin postgres
mkdir -p /var/lib/codegamer-pg /run/postgresql
chown postgres:postgres /var/lib/codegamer-pg /run/postgresql
runuser -u postgres -- /opt/postgres/bin/initdb -D /var/lib/codegamer-pg --auth-local=peer --auth-host=reject
printf '%s\n' 'local all root peer map=codegamer' 'local codegamer cg_student peer map=codegamer' 'local all postgres peer' > /var/lib/codegamer-pg/pg_hba.conf
printf '%s\n' 'codegamer root root' 'codegamer student cg_student' > /var/lib/codegamer-pg/pg_ident.conf
printf '%s\n' "listen_addresses=''" "unix_socket_directories='/run/postgresql'" "max_connections=8" "shared_buffers='64MB'" "work_mem='8MB'" "temp_file_limit='32MB'" >> /var/lib/codegamer-pg/postgresql.conf
runuser -u postgres -- /opt/postgres/bin/pg_ctl -D /var/lib/codegamer-pg -w start
runuser -u postgres -- /opt/postgres/bin/psql -v ON_ERROR_STOP=1 -c 'CREATE ROLE root LOGIN SUPERUSER; CREATE ROLE cg_student LOGIN;'
runuser -u postgres -- /opt/postgres/bin/createdb -O root codegamer
/opt/postgres/bin/psql -U root -d codegamer -v ON_ERROR_STOP=1 -c "REVOKE CREATE ON SCHEMA public FROM PUBLIC; REVOKE TEMP ON DATABASE codegamer FROM PUBLIC; ALTER ROLE cg_student SET default_transaction_read_only=on; ALTER ROLE cg_student SET statement_timeout='4s';"
runuser -u postgres -- /opt/postgres/bin/pg_ctl -D /var/lib/codegamer-pg -w stop
chmod -R a+rX /opt/cargo
find /opt/libs /opt/kotlin-libs /opt/dotnet /opt/go /opt/kotlin /opt/postgres -type f -exec sha256sum {} + > /opt/codegamer/artifact-sha256.txt
rm -rf /tmp/node* /tmp/go.tar.gz /tmp/dotnet.tar.gz /tmp/kotlin.zip /tmp/postgresql-* /tmp/pg.tar.bz2 /var/lib/apt/lists/*
