import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), execute: vi.fn() }));
vi.mock("../supabase/functions/_shared/db.ts", () => ({
  Database: class {
    rpc = mocks.rpc;
  },
  env: (name: string) => name,
  secretsMatch: vi.fn(),
}));
vi.mock("../supabase/functions/_shared/execution.ts", () => ({
  LocalExecutionProvider: class {
    execute = mocks.execute;
  },
  E2BExecutionProvider: class {
    execute = mocks.execute;
  },
}));
import { processOne } from "../supabase/functions/coordinator/index";
import { challenges } from "../src/content/catalog";
import { getEvaluation } from "../judge/index";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const metrics = { cpuMs: 1, wallMs: 2, peakMemoryKiB: 100 };
function setup(
  kind: "run" | "submission",
  stdout: string,
  executionMode = "program",
  languageId = "javascript",
) {
  vi.stubGlobal("Deno", { env: { get: () => "local" } });
  const challenge = challenges.find((c) => c.id === "sum-two-integers")!;
  mocks.rpc.mockResolvedValueOnce({
    submission: {
      id: "submission",
      challenge_version_id: challenge.versionId,
      language_id: languageId,
      execution_mode: executionMode,
      kind,
      files: [{ path: "solution.js", content: "console.log(42)" }],
      stdin: "custom input",
    },
    leaseToken: "lease",
    runtime: {
      template_id: "local",
      manifest_sha256: "manifest",
      runtime_version: "24",
    },
  });
  mocks.execute.mockResolvedValue({
    termination: "ok",
    cases: [{ termination: "ok", stdout, stderr: "", metrics }],
  });
}
it("runs the function with the first example and shows logs without grading its return", async () => {
  setup("run", "debug\n42\n", "function");
  await processOne();
  expect(mocks.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      executionMode: "function",
      cases: [{ input: { a: 2, b: 3 } }],
    }),
  );
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "finish_evaluation",
    expect.objectContaining({
      p_verdict: "accepted",
      p_result: expect.objectContaining({ stdout: "debug\n42\n" }),
    }),
  );
});
it.each(["run", "submission"] as const)(
  "provides actionable missing-function guidance for a %s without exposing raw errors",
  async (kind) => {
    setup(kind, "", "function");
    mocks.execute.mockResolvedValue({
      termination: "ok",
      cases: [
        {
          termination: "runtime_error",
          stdout: "",
          stderr:
            "TypeError: student.solve is not a function\nSECRET_CASE_FROM_RUNTIME",
          metrics,
        },
      ],
    });
    await processOne();
    const result = mocks.rpc.mock.calls.at(-1)![1];
    expect(result.p_verdict).toBe("runtime_error");
    expect(result.p_result.message).toContain("export function solve(input)");
    if (kind === "run") expect(result.p_result.stderr).toContain("TypeError");
    else
      expect(JSON.stringify(result.p_result)).not.toContain(
        "SECRET_CASE_FROM_RUNTIME",
      );
  },
);

it("explains the Python function name on a practice error", async () => {
  setup("run", "", "function", "python");
  mocks.execute.mockResolvedValue({
    termination: "ok",
    cases: [
      {
        termination: "runtime_error",
        stdout: "",
        stderr: "AttributeError: module 'solution' has no attribute 'solve'",
        metrics,
      },
    ],
  });
  await processOne();
  expect(mocks.rpc.mock.calls.at(-1)![1].p_result.message).toContain(
    "def solve(input):",
  );
});

it("explains an undefined return but keeps practice free and preserves stdout", async () => {
  setup("run", "debug\nundefined\n", "function");
  await processOne();
  const result = mocks.rpc.mock.calls.at(-1)![1];
  expect(result.p_verdict).toBe("accepted");
  expect(result.p_result.message).toContain("sem devolver uma resposta");
  expect(result.p_result.stdout).toBe("debug\nundefined\n");
});

it("accepts official function returns with logs and keeps logs outside the returned value", async () => {
  setup("submission", "", "function");
  const evaluation = getEvaluation("sum-two-integers", "javascript");
  mocks.execute.mockResolvedValue({
    termination: "ok",
    cases: evaluation.cases.map((test) => ({
      termination: "ok",
      stdout: `debug\n${JSON.stringify(test.expected)}\n`,
      stderr: "",
      metrics,
    })),
  });
  await processOne();
  expect(mocks.rpc.mock.calls.at(-1)![1].p_verdict).toBe("accepted");
});

it("reports a wrong official function result without treating valid JSON as a missing return", async () => {
  setup("submission", "0\n", "function");
  await processOne();
  const result = mocks.rpc.mock.calls.at(-1)![1];
  expect(result.p_verdict).toBe("wrong_answer");
  expect(result.p_result.message).not.toContain("sem devolver");
});
it("returns free program output without treating a different answer as a rejection", async () => {
  setup("run", "Hello from my program\n");
  await processOne();
  expect(mocks.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      executionMode: "program",
      cases: [{ input: null, stdin: "custom input" }],
    }),
  );
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "finish_evaluation",
    expect.objectContaining({
      p_verdict: "accepted",
      p_result: expect.objectContaining({
        stdout: "Hello from my program\n",
        stderr: "",
      }),
    }),
  );
});
it("checks official program submissions against fixed cases and ignores custom input", async () => {
  setup("submission", "42\n");
  await processOne();
  const request = mocks.execute.mock.calls[0][0];
  expect(request.cases.length).toBeGreaterThan(1);
  expect(
    request.cases.every(
      (entry: { stdin?: string }) => entry.stdin === undefined,
    ),
  ).toBe(true);
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "finish_evaluation",
    expect.objectContaining({ p_verdict: "wrong_answer" }),
  );
});
