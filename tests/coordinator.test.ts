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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const metrics = { cpuMs: 1, wallMs: 2, peakMemoryKiB: 100 };
function setup(
  kind: "run" | "submission",
  stdout: string,
  executionMode = "program",
) {
  vi.stubGlobal("Deno", { env: { get: () => "local" } });
  const challenge = challenges.find((c) => c.id === "sum-two-integers")!;
  mocks.rpc.mockResolvedValueOnce({
    submission: {
      id: "submission",
      challenge_version_id: challenge.versionId,
      language_id: "javascript",
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
