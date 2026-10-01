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
