import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), rows: vi.fn() }));
vi.mock("../supabase/functions/_shared/db.ts", async (original) => ({
  ...(await original<typeof import("../supabase/functions/_shared/db.ts")>()),
  Database: class {
    rpc = mocks.rpc;
    rows = mocks.rows;
  },
  authenticatedUser: async () => ({ id: "learner", anonymous: true }),
}));
vi.mock("../supabase/functions/_shared/bff.ts", () => ({
  rateLimit: async () => {},
  verifyBff: async () => {},
  sha256: async () => "digest",
}));
vi.mock("../supabase/functions/coordinator/index.ts", () => ({
  executorStatus: vi.fn().mockResolvedValue("paused"),
}));
import { handler } from "../supabase/functions/api/index";
import { ApiError } from "../supabase/functions/_shared/db";

beforeEach(() => {
  vi.stubGlobal("Deno", { env: { get: () => undefined } });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("executor offline")),
  );
  mocks.rpc.mockImplementation(async (name, args) => {
    if (name === "user_context")
      return { availableLanguages: [], hardEnabled: false };
    if (name === "submit_quiz")
      return {
        id: "quiz-result",
        attempt_id: args.p_attempt,
        status: "finished",
        verdict: args.p_verdict,
        public_result: args.p_result,
      };
    return {};
  });
  mocks.rows.mockImplementation(async (table) =>
    table === "challenge_versions"
      ? [{ id: "concept-values:v1", challenge_id: "concept-values" }]
      : [{ amount: 20 }],
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function answer(body: Record<string, unknown>) {
  return handler(
    new Request("http://localhost/api/quiz-submissions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "quiz-test-request",
      },
      body: JSON.stringify({
        challengeVersionId: "concept-values:v1",
        attemptId: "owned-attempt",
        ...body,
      }),
    }),
  );
}

it("evaluates a concept without consulting the executor or accepting a client verdict", async () => {
  const response = await answer({
    optionId: "a",
    verdict: "accepted",
    xpAwarded: 99999,
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    verdict: "wrong_answer",
    status: "completed",
  });
  expect(mocks.rpc).toHaveBeenCalledWith(
    "submit_quiz",
    expect.objectContaining({
      p_user: "learner",
      p_attempt: "owned-attempt",
      p_option: "a",
      p_verdict: "wrong_answer",
    }),
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("rejects an option outside the public question before recording an attempt", async () => {
  const response = await answer({ optionId: "forged-option" });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { code: "invalid_option" },
  });
  expect(mocks.rpc.mock.calls.some(([name]) => name === "submit_quiz")).toBe(
    false,
  );
});

it("returns the atomic recorded reward for a correct answer", async () => {
  const response = await answer({ optionId: "b" });
  expect(await response.json()).toMatchObject({
    verdict: "accepted",
    xpAwarded: 20,
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("propagates ownership validation without claiming a completion", async () => {
  const original = mocks.rpc.getMockImplementation()!;
  mocks.rpc.mockImplementation((name, args) =>
    name === "submit_quiz"
      ? Promise.reject(new ApiError("attempt_not_found", 409))
      : original(name, args),
  );
  const response = await answer({
    attemptId: "another-users-attempt",
    optionId: "b",
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    error: { code: "attempt_not_found" },
  });
});
