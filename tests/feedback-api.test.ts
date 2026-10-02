import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  rows: vi.fn(),
  user: vi.fn(),
}));
vi.mock("../supabase/functions/_shared/db.ts", async (original) => ({
  ...(await original<typeof import("../supabase/functions/_shared/db.ts")>()),
  Database: class {
    rpc = mocks.rpc;
    rows = mocks.rows;
  },
  authenticatedUser: mocks.user,
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

const receipt = {
  protocol: "00000000-0000-4000-8000-000000000001",
  createdAt: "2026-10-01T12:00:00Z",
};
beforeEach(() => {
  vi.stubGlobal("Deno", { env: { get: () => undefined } });
  mocks.user.mockResolvedValue({
    id: "anonymous-learner",
    anonymous: true,
    email: "",
    name: "Explorador",
    githubLogin: null,
  });
  mocks.rpc.mockImplementation(async (name) =>
    name === "submit_product_feedback" ? receipt : {},
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function send(
  body: Record<string, unknown>,
  key: string | null = "feedback-request",
) {
  return handler(
    new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key === null ? {} : { "idempotency-key": key }),
      },
      body: JSON.stringify({
        category: "suggestion",
        message: "Gostaria de mais exemplos.",
        ...body,
      }),
    }),
  );
}

it("persists text for an anonymous authenticated identity and exposes only its durable receipt", async () => {
  const response = await send({
    contactEmail: " user@example.com ",
    challengeId: "find-max",
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual(receipt);
  expect(mocks.rpc).toHaveBeenCalledWith("submit_product_feedback", {
    p_user: "anonymous-learner",
    p_category: "suggestion",
    p_message: "Gostaria de mais exemplos.",
    p_contact_email: "user@example.com",
    p_challenge: "find-max",
    p_key: "feedback-request",
  });
  expect(mocks.rows).not.toHaveBeenCalled();
  expect(mocks.rpc.mock.calls.some(([name]) => name === "user_context")).toBe(
    false,
  );
});

it.each([
  { category: "other" },
  { message: "short" },
  { message: "x".repeat(4001) },
  { contactEmail: "invalid" },
  { challengeId: "../private" },
  { attachments: ["media"] },
  { userId: "other" },
])(
  "rejects invalid or forged feedback before its persistence RPC: %j",
  async (body) => {
    const response = await send(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_feedback" },
    });
    expect(
      mocks.rpc.mock.calls.some(([name]) => name === "submit_product_feedback"),
    ).toBe(false);
  },
);

it("requires an idempotency key before saving", async () => {
  const response = await send({}, null);
  expect(response.status).toBe(400);
  expect(
    mocks.rpc.mock.calls.some(([name]) => name === "submit_product_feedback"),
  ).toBe(false);
});

it("rejects unauthenticated requests before persistence", async () => {
  mocks.user.mockRejectedValue(new ApiError("authentication_required", 401));
  expect((await send({})).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("reuses the database receipt when the client retries the same idempotency key", async () => {
  expect(await (await send({})).json()).toEqual(receipt);
  expect(await (await send({})).json()).toEqual(receipt);
  expect(
    mocks.rpc.mock.calls.filter(([name]) => name === "submit_product_feedback"),
  ).toHaveLength(2);
});

it.each(["feedback_hourly_limit", "feedback_daily_limit"])(
  "propagates the atomic quota %s without reporting success",
  async (code) => {
    mocks.rpc.mockImplementation(async (name) => {
      if (name === "submit_product_feedback") throw new ApiError(code, 409);
      return {};
    });
    const response = await send({});
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toMatchObject({ error: { code } });
  },
);

it.each(["idempotency_conflict", "challenge_not_found"])(
  "does not claim receipt for a rejected database write: %s",
  async (code) => {
    mocks.rpc.mockImplementation(async (name) => {
      if (name === "submit_product_feedback") throw new ApiError(code, 409);
      return {};
    });
    const response = await send({});
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code } });
  },
);

it.each([
  null,
  {},
  { protocol: "forged", createdAt: receipt.createdAt },
  { protocol: "-".repeat(36), createdAt: receipt.createdAt },
])(
  "does not invent a receipt when persistence returns an invalid result %j",
  async (result) => {
    mocks.rpc.mockImplementation(async (name) =>
      name === "submit_product_feedback" ? result : {},
    );
    const response = await send({});
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { code: "database_error" },
    });
  },
);

it("returns a failure if the persistence service is unreachable", async () => {
  mocks.rpc.mockImplementation(async (name) => {
    if (name === "submit_product_feedback") throw new Error("offline");
    return {};
  });
  expect((await send({})).status).toBe(500);
});

it("bounds feedback bytes before idempotency bookkeeping", async () => {
  const response = await send({ message: "x".repeat(25_000) });
  expect(response.status).toBe(413);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it.each([null, false, 0, "message", []])(
  "rejects non-object JSON before consuming it again or saving: %j",
  async (body) => {
    const response = await handler(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "primitive-feedback",
        },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_json" },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  },
);
