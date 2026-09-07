ARG BASE_IMAGE=debian:bookworm-slim@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171
FROM ${BASE_IMAGE}
USER root
COPY executor/install-runtimes.sh /tmp/rods-install-runtimes.sh
COPY executor/requirements.txt /tmp/rods-requirements.txt
RUN test -s /tmp/rods-install-runtimes.sh \
 && test -s /tmp/rods-requirements.txt \
 && bash /tmp/rods-install-runtimes.sh \
 && cp -a /var/lib/codegamer-pg /opt/codegamer/postgres-seed
COPY executor/supervisor.py /opt/codegamer/supervisor.py
COPY executor/adapters.py /opt/codegamer/adapters.py
COPY executor/sql_policy.py /opt/codegamer/sql_policy.py
COPY executor/sql_runner.py /opt/codegamer/sql_runner.py
COPY executor/manifest.example.json /opt/codegamer/manifest.json
COPY executor/boot.sh /opt/codegamer/boot.sh
COPY executor/local-job.sh /opt/codegamer/local-job.sh
RUN useradd --uid 12000 --no-create-home --shell /usr/sbin/nologin student \
 && mkdir -p /workspace /run/codegamer /opt/codegamer /job \
 && chmod 700 /run/codegamer \
 && chmod 700 /job \
 && chmod 755 /opt/codegamer /workspace \
 && chmod 444 /opt/codegamer/*.py /opt/codegamer/manifest.json \
 && chmod 555 /opt/codegamer/boot.sh /opt/codegamer/local-job.sh \
 && chmod -R a+rX /opt/codegamer/postgres-seed \
 && find / -xdev -type f -perm /6000 -exec chmod a-s {} + 2>/dev/null
ENV PATH="/usr/local/bin:/usr/bin:/bin:/opt/dotnet:/opt/go/bin:/opt/kotlin/bin:/opt/postgres/bin"
ENV CARGO_HOME="/opt/cargo"
# boot.sh is used as the E2B template start command; requires delegated cgroup v2.
CMD ["/opt/codegamer/boot.sh"]
