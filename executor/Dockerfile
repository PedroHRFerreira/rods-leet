ARG BASE_IMAGE
FROM ${BASE_IMAGE}
USER root
COPY executor/install-runtimes.sh /tmp/install-runtimes.sh
COPY executor/requirements.txt /tmp/requirements.txt
RUN bash /tmp/install-runtimes.sh
COPY executor/supervisor.py executor/adapters.py executor/sql_policy.py executor/sql_runner.py /opt/codegamer/
COPY executor/manifest.example.json /opt/codegamer/manifest.json
COPY executor/boot.sh /opt/codegamer/boot.sh
RUN useradd --uid 12000 --no-create-home --shell /usr/sbin/nologin student \
 && mkdir -p /workspace /run/codegamer /opt/codegamer \
 && chmod 700 /run/codegamer \
 && chmod 755 /opt/codegamer /workspace \
 && chmod 444 /opt/codegamer/*.py /opt/codegamer/manifest.json \
 && chmod 555 /opt/codegamer/boot.sh \
 && find / -xdev -type f -perm /6000 -exec chmod a-s {} + 2>/dev/null
ENV PATH="/usr/local/bin:/usr/bin:/bin:/opt/dotnet:/opt/go/bin:/opt/kotlin/bin:/opt/postgres/bin"
ENV CARGO_HOME="/opt/cargo"
# boot.sh is used as the E2B template start command; requires delegated cgroup v2.
CMD ["/opt/codegamer/boot.sh"]
