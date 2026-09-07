import { Sandbox } from "e2b";

const apiKey = Deno.env.get("E2B_API_KEY");
const templateId = Deno.env.get("E2B_TEMPLATE_ID");

if (
  Deno.env.get("ALLOW_E2B_HOMOLOGATION") !== "true" ||
  !apiKey ||
  !templateId
) {
  throw new Error(
    "Set ALLOW_E2B_HOMOLOGATION=true, E2B_API_KEY and E2B_TEMPLATE_ID explicitly.",
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const sandbox = await Sandbox.create(templateId, {
  apiKey,
  timeoutMs: 90_000,
  requestTimeoutMs: 10_000,
  secure: true,
  allowInternetAccess: false,
  network: { allowPublicTraffic: false, denyOut: ["0.0.0.0/0"] },
  metadata: { purpose: "rods-leet-runtime-homologation" },
});

try {
  const diagnosticScript = [
    "set -euo pipefail",
    "test -f /run/codegamer/ready",
    "test -f /sys/fs/cgroup/codegamer/cgroup.controllers",
    'test "$(stat -c %U:%a /opt/codegamer/supervisor.py)" = root:444',
    'test "$(stat -c %U:%a /opt/codegamer/adapters.py)" = root:444',
    "runuser -u student -- test ! -r /run/codegamer",
    "if curl -fsS --connect-timeout 2 --max-time 3 https://example.com >/dev/null 2>&1; then exit 70; fi",
    "python3 --version",
    "node --version",
    "tsc --version",
    "javac -version",
    "dotnet --version",
    "g++ --version | head -1",
    "gcc --version | head -1",
    "go version",
    "rustc --version",
    "kotlinc -version 2>&1 | head -1",
    "postgres --version",
  ].join("\n");
  let checks;
  try {
    checks = await sandbox.commands.run(
      `bash -lc ${JSON.stringify(diagnosticScript)}`,
      {
        user: "root",
        timeoutMs: 30_000,
      },
    );
  } catch (error) {
    const result = (error as { result?: { stdout?: string; stderr?: string } })
      .result;
    console.error(result?.stdout ?? "");
    console.error(result?.stderr ?? "");
    throw error;
  }

  for (const expected of [
    "Python 3.11",
    "v22.14.0",
    "Version 5.9.3",
    "javac 17",
    "8.0.407",
    "go1.23.7",
    "rustc 1.85.0",
    "kotlinc-jvm 2.1.10",
    "PostgreSQL) 18.4",
  ]) {
    assert(
      checks.stdout.includes(expected),
      `runtime_version_mismatch:${expected}`,
    );
  }

  const manifest = await sandbox.files.read("/opt/codegamer/manifest.json", {
    user: "root",
  });
  const manifestSha256 = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(manifest)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

  await sandbox.files.write(
    "/workspace/solution.ts",
    [
      "export function findMax(values: readonly number[]): number | null {",
      "  if (values.length === 0) return null;",
      "  let best = values[0];",
      "  for (let index = 1; index < values.length; index++) {",
      "    if (values[index] > best) best = values[index];",
      "  }",
      "  return best;",
      "}",
    ].join("\n"),
    { user: "root" },
  );
  await sandbox.files.write(
    "/run/codegamer/request.json",
    JSON.stringify({
      languageId: "typescript",
      functionName: "findMax",
      manifestSha256,
      cases: [
        { input: [3, 7, 2, 9, 1] },
        { input: [-8, -3, -12] },
        { input: [] },
      ],
    }),
    { user: "root" },
  );
  await sandbox.commands.run(
    "/opt/python/bin/python3 -I /opt/codegamer/supervisor.py",
    { user: "root", timeoutMs: 60_000 },
  );
  const result = JSON.parse(
    await sandbox.files.read("/run/codegamer/result.json", { user: "root" }),
  );
  assert(result.termination === "ok", "reference_solution_failed");
  assert(result.cases.length === 3, "reference_case_count_mismatch");
  const outputs = result.cases.map((item: { stdout: string }) =>
    JSON.parse(item.stdout),
  );
  assert(outputs[0].result === 9, "reference_positive_case_failed");
  assert(outputs[1].result === -3, "reference_negative_case_failed");
  assert(outputs[2].result === null, "reference_empty_case_failed");
  assert(
    outputs.every(
      (output: { inputUnchanged: boolean }) => output.inputUnchanged,
    ),
    "input_mutated",
  );

  console.log(
    JSON.stringify({
      templateId,
      manifestSha256,
      homologated: true,
      checks: "runtimes,network,permissions,cgroup,reference",
    }),
  );
} finally {
  await sandbox.kill().catch(() => undefined);
}
