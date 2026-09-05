import { Template, waitForFile } from "e2b";
// Explicit local command only: building a cloud template consumes confirmed credits.
const key = Deno.env.get("E2B_API_KEY");
const base = Deno.env.get("RUNTIME_BASE_IMAGE");
if (Deno.env.get("ALLOW_E2B_TEMPLATE_BUILD") !== "true" || !key) {
  throw new Error(
    "Set ALLOW_E2B_TEMPLATE_BUILD=true only after reserving the build budget.",
  );
}
if (!base || !/^debian:bookworm-slim@sha256:[a-f0-9]{64}$/.test(base)) {
  throw new Error(
    "RUNTIME_BASE_IMAGE must be a reviewed Debian bookworm-slim image pinned by sha256 digest.",
  );
}
const dockerfile = (await Deno.readTextFile("executor/Dockerfile")).replace(
  "ARG BASE_IMAGE\nFROM ${BASE_IMAGE}",
  `FROM ${base}`,
);
const template = Template({
  fileContextPath: ".",
  fileIgnorePatterns: [
    ".git",
    ".codex",
    ".agents",
    "node_modules",
    "dist",
    ".env*",
    "supabase",
    "src",
    "judge",
    "executor/test_*.py",
    "executor/__pycache__",
  ],
})
  .fromDockerfile(dockerfile)
  .setStartCmd("/opt/codegamer/boot.sh", waitForFile("/run/codegamer/ready"));
const built = await Template.build(template, "codegamer-beta-v1", {
  apiKey: key,
  cpuCount: 2,
  memoryMB: 2048,
});
console.log(
  JSON.stringify({
    templateId: built.templateId,
    buildId: built.buildId,
    homologated: false,
  }),
);
