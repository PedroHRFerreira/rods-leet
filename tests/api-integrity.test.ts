import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "../supabase/functions/_shared/db";
import {
  presentAttempt,
  presentSubmission,
} from "../supabase/functions/_shared/presenters";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  rows: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("../supabase/functions/_shared/db.ts", async (original) => ({
  ...(await original<typeof import("../supabase/functions/_shared/db.ts")>()),
  Database: class {
    rpc = mocks.rpc;
    rows = mocks.rows;
  },
  authenticatedUser: async () => ({ id: "learner", anonymous: false }),
}));
vi.mock("../supabase/functions/_shared/bff.ts", () => ({
  rateLimit: async () => {},
  verifyBff: mocks.verify,
  sha256: async () => "digest",
}));
vi.mock("../supabase/functions/coordinator/index.ts", () => ({
  executorStatus: async () => "ready",
}));
import { handler } from "../supabase/functions/api/index";

const submission = {
  id: "pending-submission",
  attempt_id: "owned-attempt",
  kind: "submission",
  status: "finished",
  verdict: "accepted",
  integrity_status: "pending_review",
  public_result: { message: "Aceito" },
  challenge_version_id: "concept-values:v1",
};
beforeEach(() => {
  vi.stubGlobal("Deno", { env: { get: () => undefined } });
  mocks.verify.mockResolvedValue(undefined);
  mocks.rpc.mockImplementation(async (name) => {
    if (name === "admit_user") return { xp: 0, hint_balance: 0 };
    if (name === "user_context")
      return {
        availableLanguages: [],
        assistance: [],
        usage: { tutor_calls: 0 },
      };
    if (name === "integrity_summary") return { pendingCount: 1 };
    if (name === "submission_review") return "review-protocol";
    return {};
  });
  mocks.rows.mockImplementation(async (table, query) => {
    if (table === "challenge_versions") return [{ id: "concept-values:v1" }];
    if (table === "submissions") return [submission];
    if (table === "xp_events") return [{ amount: 100 }];
    if (table === "attempts")
      return query.includes("select=rejected_count")
        ? []
        : [
            {
              id: "owned-attempt",
              challenge_id: "concept-values",
              state: "active",
              rejected_count: 0,
            },
          ];
    if (table === "profiles") return [];
    return [];
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
const get = (path: string) =>
  handler(new Request(`http://localhost/api${path}`));

it("requires a valid BFF signature even when BFF_REQUIRED is unset", async () => {
  mocks.verify.mockRejectedValue(new ApiError("bff_required", 403));
  const response = await get("/dashboard");
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({
    error: { code: "bff_required" },
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("retains the review protocol and withholds claimed XP on submission reads", async () => {
  const response = await get("/submissions/pending-submission");
  expect(await response.json()).toMatchObject({
    integrityStatus: "pending_review",
    reviewProtocol: "review-protocol",
    xpAwarded: 0,
  });
  expect(mocks.rpc).toHaveBeenCalledWith("submission_review", {
    p_user: "learner",
    p_submission: "pending-submission",
  });
});

it("keeps pending review metadata on the latest attempt", async () => {
  const response = await get("/attempts/owned-attempt");
  expect(await response.json()).toMatchObject({
    latestSubmissionId: "pending-submission",
    integrityStatus: "pending_review",
    reviewProtocol: "review-protocol",
  });
  expect(mocks.rows).toHaveBeenCalledWith(
    "submissions",
    expect.stringContaining("order=created_at.desc"),
  );
});

it("keeps review summary and eligible progress filtering on the dashboard and ranking", async () => {
  const response = await get("/dashboard");
  expect(await response.json()).toMatchObject({
    integrity: { pendingCount: 1 },
    recentSubmissions: [
      { integrityStatus: "pending_review", reviewProtocol: "review-protocol" },
    ],
  });
  expect(mocks.rows).toHaveBeenCalledWith(
    "completions",
    expect.stringContaining("reward_eligible=eq.true"),
  );
  await get("/ranking");
  expect(mocks.rows).toHaveBeenCalledWith(
    "completions",
    "reward_eligible=eq.true&select=user_id,challenge_id",
  );
});

it("leaves clear rewards intact and masks rejected rewards in presenters", () => {
  expect(
    presentSubmission({ ...submission, integrity_status: "clear" }, 20)
      .xpAwarded,
  ).toBe(20);
  expect(
    presentSubmission({ ...submission, integrity_status: "rejected" }, 20)
      .xpAwarded,
  ).toBe(0);
  expect(
    presentAttempt({ state: "active" }, {}, [submission], false, 0, "protocol"),
  ).toMatchObject({
    integrityStatus: "pending_review",
    reviewProtocol: "protocol",
  });
});
