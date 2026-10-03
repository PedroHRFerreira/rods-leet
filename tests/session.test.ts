import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), rateLimit: vi.fn() }));
vi.mock("../supabase/functions/_shared/db.ts", async (original) => ({
  ...(await original<object>()),
  Database: class {
    rpc = mocks.rpc;
  },
}));
vi.mock("../supabase/functions/_shared/bff.ts", () => ({
  verifyBff: vi.fn(),
  rateLimit: mocks.rateLimit,
}));
import { handler } from "../supabase/functions/session/index";
import { ApiError } from "../supabase/functions/_shared/db.ts";
afterEach(() => vi.clearAllMocks());
const request = (body: object) =>
  new Request("https://example.test/session", {
    method: "POST",
    body: JSON.stringify(body),
  });
it("accepts the anonymous creation rate bucket and applies the admission ceiling", async () => {
  const bucket = `anonymous-create:${"a".repeat(64)}`;
  const response = await handler(request({ op: "rate", bucket }));
  expect(response.status).toBe(200);
  expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), bucket, 5);
});
it("admits email authentication with the same five-request ceiling, ignoring caller limits", async () => {
  const bucket = `email-auth:${"b".repeat(64)}`;
  const response = await handler(request({ op: "rate", bucket, limit: 9999 }));
  expect(response.status).toBe(200);
  expect(await response.json()).toBe(true);
  expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), bucket, 5);
});
it.each([
  `email-auth:${"b".repeat(63)}`,
  `email-auth:${"B".repeat(64)}`,
  `email-auth:${"b".repeat(64)}:extra`,
  `purchase:${"b".repeat(64)}`,
])("rejects unsupported or malformed admission buckets: %s", async (bucket) => {
  const response = await handler(request({ op: "rate", bucket }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: { code: "invalid_bucket" } });
  expect(mocks.rateLimit).not.toHaveBeenCalled();
});
it("preserves email rate limiting and exposes a bounded retry interval", async () => {
  mocks.rateLimit.mockRejectedValueOnce(new ApiError("rate_limited", 429));
  const response = await handler(
    request({ op: "rate", bucket: `email-auth:${"b".repeat(64)}` }),
  );
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("60");
  expect(await response.json()).toEqual({ error: { code: "rate_limited" } });
});
it("stores anonymous sessions through the signed private service", async () => {
  mocks.rpc.mockResolvedValueOnce({ version: 1 });
  const response = await handler(
    request({
      op: "create-anonymous",
      id: "a".repeat(64),
      payload: "ciphertext",
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith(
    "bff_session",
    expect.objectContaining({
      p_op: "create-anonymous",
      p_payload: "ciphertext",
    }),
  );
});
