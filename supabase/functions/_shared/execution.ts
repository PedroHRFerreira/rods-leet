import { Sandbox } from "e2b";
import { ApiError } from "./db.ts";
export interface ExecutionRequest {
  submissionId: string;
  templateId: string;
  manifestSha256: string;
  languageId: string;
  runtimeVersion: string;
  functionName: string;
  files: Array<{ path: string; content: string }>;
  cases: Array<{ input: unknown }>;
  sqlSchema?: string;
}
export interface CaseExecution {
  termination:
    "ok" | "runtime_error" | "time_limit" | "memory_limit" | "output_limit";
  stdout: string;
  stderr: string;
  metrics: { cpuMs: number; wallMs: number; peakMemoryKiB: number };
}
export interface ExecutionResult {
  executionRef?: string;
  termination: string;
  cases: CaseExecution[];
  compilation?: CaseExecution;
}
export interface CodeExecutionProvider {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  cancel(executionRef: string): Promise<void>;
}

function validateResult(value: unknown): ExecutionResult {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as ExecutionResult).termination !== "string" ||
    !Array.isArray((value as ExecutionResult).cases)
  ) {
    throw new ApiError("invalid_executor_result", 503);
  }
  return value as ExecutionResult;
}

export class LocalExecutionProvider implements CodeExecutionProvider {
  constructor(
    private endpoint: string,
    private token: string,
  ) {}

  async isReady(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);
    try {
      const response = await fetch(
        `${this.endpoint.replace(/\/$/, "")}/health`,
        { signal: controller.signal },
      );
      if (!response.ok) return false;
      const body = await response.json();
      return Boolean(
        body &&
        typeof body === "object" &&
        (body as { status?: unknown }).status === "ok",
      );
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 95_000);
    try {
      const response = await fetch(
        `${this.endpoint.replace(/\/$/, "")}/v1/execute`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new ApiError("executor_unavailable", 503);
      const text = await response.text();
      if (new TextEncoder().encode(text).length > 2 * 1024 * 1024) {
        throw new ApiError("invalid_executor_result", 503);
      }
      return validateResult(JSON.parse(text));
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("executor_unavailable", 503);
    } finally {
      clearTimeout(timeout);
    }
  }

  async cancel(): Promise<void> {
    // Jobs are synchronous and the gateway destroys the container on disconnect/TTL.
  }
}

export class E2BExecutionProvider implements CodeExecutionProvider {
  constructor(private apiKey: string) {}
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (!request.templateId || !request.manifestSha256) {
      throw new ApiError("runtime_unavailable", 503);
    }
    const sandbox = await Sandbox.create(request.templateId, {
      apiKey: this.apiKey,
      timeoutMs: 90000,
      requestTimeoutMs: 10000,
      secure: true,
      allowInternetAccess: false,
      network: { allowPublicTraffic: false, denyOut: ["0.0.0.0/0"] },
      metadata: {
        submissionId: request.submissionId,
        runtimeVersion: request.runtimeVersion,
      },
    });
    try {
      await sandbox.files.write(
        request.files.map((f) => ({
          path: `/workspace/${f.path}`,
          data: f.content,
        })),
        { user: "root" },
      );
      // Expected outputs, hidden-test labels and gabaritos are never transferred.
      await sandbox.files.write(
        "/run/codegamer/request.json",
        JSON.stringify({
          languageId: request.languageId,
          functionName: request.functionName,
          manifestSha256: request.manifestSha256,
          cases: request.cases.map((c) => ({ input: c.input })),
          sqlSchema: request.sqlSchema,
        }),
        { user: "root" },
      );
      await sandbox.commands
        .run("/opt/python/bin/python3 -I /opt/codegamer/supervisor.py", {
          user: "root",
          timeoutMs: 85000,
        })
        .catch(() => {});
      const text = await sandbox.files.read("/run/codegamer/result.json", {
        user: "root",
      });
      if (new TextEncoder().encode(text).length > 2 * 1024 * 1024) {
        throw new ApiError("invalid_executor_result", 503);
      }
      return {
        ...validateResult(JSON.parse(text)),
        executionRef: sandbox.sandboxId,
      };
    } finally {
      try {
        await sandbox.kill();
      } catch {
        console.error(
          JSON.stringify({
            event: "sandbox_cleanup_failed",
            submissionId: request.submissionId,
          }),
        );
      }
      // Remote TTL remains active even when the coordinator disappears entirely.
    }
  }
  async cancel(executionRef: string) {
    await Sandbox.kill(executionRef, { apiKey: this.apiKey });
  }
}
