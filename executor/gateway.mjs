import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const host = process.env.EXECUTOR_HOST ?? "127.0.0.1";
const port = Number(process.env.EXECUTOR_PORT ?? "8789");
const token = process.env.LOCAL_EXECUTOR_TOKEN ?? "";
const image = process.env.EXECUTOR_IMAGE ?? "rods-leet-executor:local";
const maxRequestBytes = 2 * 1024 * 1024;
const formatOrLineSeparator = /[\p{Cf}\p{Zl}\p{Zp}]/u;
const control = /\p{Cc}/u;
let active = false;

function hasUnsafeSourceCharacters(content) {
  for (const character of content) {
    if (
      formatOrLineSeparator.test(character) ||
      (control.test(character) && !["\n", "\r", "\t"].includes(character))
    )
      return true;
  }
  return false;
}

if (token.length < 32)
  throw new Error("LOCAL_EXECUTOR_TOKEN must have at least 32 characters");

function authorized(header = "") {
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const left = createHash("sha256").update(supplied).digest();
  const right = createHash("sha256").update(token).digest();
  return timingSafeEqual(left, right);
}

function send(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validate(input) {
  if (!input || typeof input !== "object") throw new Error("invalid_request");
  if (
    !Array.isArray(input.files) ||
    input.files.length < 1 ||
    input.files.length > 20
  )
    throw new Error("invalid_files");
  if (
    !Array.isArray(input.cases) ||
    input.cases.length < 1 ||
    input.cases.length > 200
  )
    throw new Error("invalid_cases");
  let bytes = 0;
  const paths = new Set();
  for (const file of input.files) {
    if (typeof file?.path !== "string" || typeof file?.content !== "string")
      throw new Error("invalid_file");
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/.test(file.path) ||
      file.path
        .split("/")
        .some(
          (part) => part === "." || part === ".." || part.startsWith("."),
        ) ||
      paths.has(file.path) ||
      hasUnsafeSourceCharacters(file.content)
    )
      throw new Error("invalid_path");
    paths.add(file.path);
    bytes += Buffer.byteLength(file.content);
  }
  if (bytes > 256 * 1024) throw new Error("code_too_large");
  for (const key of [
    "submissionId",
    "manifestSha256",
    "languageId",
    "runtimeVersion",
    "functionName",
  ]) {
    if (typeof input[key] !== "string" || input[key].length > 200)
      throw new Error("invalid_request");
  }
}

async function execute(input, request) {
  const jobRoot = await mkdtemp(join(tmpdir(), "rods-executor-"));
  const inputRoot = join(jobRoot, "input");
  const filesRoot = join(inputRoot, "files");
  await mkdir(filesRoot, { recursive: true, mode: 0o700 });
  try {
    for (const file of input.files) {
      const destination = join(filesRoot, file.path);
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, file.content, { mode: 0o600 });
    }
    await writeFile(
      join(inputRoot, "request.json"),
      JSON.stringify({
        languageId: input.languageId,
        functionName: input.functionName,
        manifestSha256: input.manifestSha256,
        cases: input.cases.map(({ input: value }) => ({ input: value })),
        sqlSchema: input.sqlSchema,
      }),
      { mode: 0o600 },
    );

    const name = `rods-job-${randomUUID()}`;
    const runDocker = (args, output = false) =>
      new Promise((resolve, reject) => {
        const process = spawn("docker", args, {
          stdio: ["ignore", output ? "pipe" : "ignore", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        process.stdout?.on("data", (chunk) => {
          if (stdout.length <= maxRequestBytes) stdout += chunk;
        });
        process.stderr.on("data", (chunk) => {
          if (stderr.length < 4096) stderr += chunk;
        });
        process.once("error", reject);
        process.once("exit", (code) =>
          code === 0
            ? resolve(stdout.trim())
            : reject(
                new Error(
                  `docker_failed:${String(code)}:${stderr.slice(0, 1000)}`,
                ),
              ),
        );
      });

    let created = false;
    let resultText = "";
    try {
      await runDocker([
        "create",
        "--name",
        name,
        "--network",
        "none",
        "--cap-drop",
        "ALL",
        "--cap-add",
        "CHOWN",
        "--cap-add",
        "FOWNER",
        "--cap-add",
        "KILL",
        "--cap-add",
        "SETUID",
        "--cap-add",
        "SETGID",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "128",
        "--cpus",
        "2",
        "--memory",
        "2g",
        "--memory-swap",
        "2g",
        "--tmpfs",
        "/workspace:rw,exec,nosuid,nodev,size=384m",
        "--tmpfs",
        "/run:rw,nosuid,nodev,size=32m",
        "--tmpfs",
        "/tmp:rw,nosuid,nodev,size=128m",
        "--tmpfs",
        "/var/lib/codegamer-pg:rw,nosuid,nodev,size=256m,uid=0,gid=0,mode=0755",
        "--entrypoint",
        "/bin/sleep",
        image,
        "infinity",
      ]);
      created = true;
      await runDocker(["start", name]);
      await runDocker(["cp", `${inputRoot}/.`, `${name}:/job/`]);
      await runDocker([
        "exec",
        name,
        "chown",
        "root:root",
        "/job/files",
        "/job/request.json",
      ]);
      await runDocker([
        "exec",
        name,
        "chown",
        "--recursive",
        "root:root",
        "/job/files",
        "/job/request.json",
      ]);
      const kill = () => spawn("docker", ["kill", name], { stdio: "ignore" });
      request.once("aborted", kill);
      const timeout = setTimeout(kill, 90_000);
      try {
        await runDocker(["exec", name, "/opt/codegamer/local-job.sh"]);
      } finally {
        clearTimeout(timeout);
        request.off("aborted", kill);
      }
      resultText = await runDocker(
        ["exec", name, "cat", "/run/codegamer/result.json"],
        true,
      );
    } finally {
      if (created) await runDocker(["rm", "--force", name]).catch(() => {});
    }
    if (Buffer.byteLength(resultText) > maxRequestBytes)
      throw new Error("result_too_large");
    return { ...JSON.parse(resultText), executionRef: name };
  } finally {
    await rm(jobRoot, { recursive: true, force: true });
  }
}

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    if (!authorized(request.headers.authorization))
      return send(response, 401, { error: "unauthorized" });
    return send(response, 200, { status: active ? "busy" : "ready" });
  }
  if (request.method !== "POST" || request.url !== "/v1/execute")
    return send(response, 404, { error: "not_found" });
  if (!authorized(request.headers.authorization))
    return send(response, 401, { error: "unauthorized" });
  if (active) return send(response, 429, { error: "busy" });
  active = true;
  try {
    const input = await readJson(request);
    validate(input);
    send(response, 200, await execute(input, request));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "execution_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    send(response, 503, { error: "executor_unavailable" });
  } finally {
    active = false;
  }
}).listen(port, host, () =>
  console.log(JSON.stringify({ event: "executor_ready", host, port })),
);
