import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { guestShop } from "../src/domain/economy";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), user: vi.fn() }));
vi.mock("../supabase/functions/_shared/db.ts", async (original) => ({
  ...(await original<typeof import("../supabase/functions/_shared/db.ts")>()),
  Database: class {
    rpc = mocks.rpc;
    rows = vi.fn().mockResolvedValue([]);
  },
  authenticatedUser: mocks.user,
}));
vi.mock("../supabase/functions/_shared/bff.ts", () => ({
  rateLimit: async () => {},
  verifyBff: async () => {},
  sha256: async () => "digest",
}));
vi.mock("../supabase/functions/coordinator/index.ts", () => ({
  executorStatus: vi.fn(),
}));
import { handler } from "../supabase/functions/api/index";
import { ApiError } from "../supabase/functions/_shared/db";
beforeEach(() => {
  vi.stubGlobal("Deno", { env: { get: () => undefined } });
  mocks.user.mockResolvedValue({ id: "learner", anonymous: false });
  mocks.rpc.mockImplementation(async (name) =>
    name === "shop_state" ? guestShop() : {},
  );
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function purchase(body: unknown) {
  return handler(
    new Request("http://localhost/api/shop/purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "purchase-key",
      },
      body: JSON.stringify(body),
    }),
  );
}
it("uses verified identity and confirmed quote, ignoring forged balances and XP", async () => {
  const response = await purchase({
    itemId: "hint-extra",
    expectedPrice: 30,
    userId: "someone-else",
    coins: 9999,
    xp: 9999,
  });
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("shop_purchase", {
    p_user: "learner",
    p_item: "hint-extra",
    p_key: "purchase-key",
    p_expected_price: 30,
  });
});
it("rejects anonymous purchases before a wallet mutation", async () => {
  mocks.user.mockResolvedValue({ id: "visitor", anonymous: true });
  expect(
    (await purchase({ itemId: "hint-extra", expectedPrice: 30 })).status,
  ).toBe(403);
  expect(mocks.rpc.mock.calls.some(([name]) => name === "shop_purchase")).toBe(
    false,
  );
});
it.each([undefined, -1, 1.5, "30"])(
  "rejects invalid quote %s before a purchase",
  async (expectedPrice) => {
    expect(
      (await purchase({ itemId: "hint-extra", expectedPrice })).status,
    ).toBe(400);
    expect(
      mocks.rpc.mock.calls.some(([name]) => name === "shop_purchase"),
    ).toBe(false);
  },
);
it("propagates a changed offer without announcing a purchase", async () => {
  mocks.rpc.mockImplementation(async (name) => {
    if (name === "shop_purchase") throw new ApiError("price_changed", 409);
    return {};
  });
  const response = await purchase({
    itemId: "theme-ocean",
    expectedPrice: 160,
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    error: { code: "price_changed" },
  });
  expect(mocks.rpc.mock.calls.some(([name]) => name === "shop_state")).toBe(
    false,
  );
});

it("ignores forged pack size, rarity and recipient when granting hints", async () => {
  const response = await purchase({
    itemId: "hint-pack3",
    expectedPrice: 75,
    hintCount: -999,
    rarity: "legendary",
    userId: "victim",
  });
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("shop_purchase", {
    p_user: "learner",
    p_item: "hint-pack3",
    p_key: "purchase-key",
    p_expected_price: 75,
  });
});
it("serves weekly ranking only for the verified identity and omits caller-controlled period", async () => {
  const state = {
    startsAt: "2026-10-05T03:00:00Z",
    endsAt: "2026-10-12T03:00:00Z",
    entries: [],
    currentUser: null,
    lastCompleted: null,
  };
  mocks.rpc.mockImplementation(async (name) =>
    name === "weekly_ranking" ? state : {},
  );
  const response = await handler(
    new Request(
      "http://localhost/api/ranking/weekly?userId=victim&startsAt=2000-01-01",
    ),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(state);
  expect(mocks.rpc).toHaveBeenCalledWith("weekly_ranking", {
    p_user: "learner",
  });
  expect(mocks.rpc.mock.calls.some(([name]) => name === "user_context")).toBe(
    false,
  );
});
it("keeps weekly ranking visible to visitors without treating them as registered", async () => {
  mocks.user.mockResolvedValue({ id: "visitor", anonymous: true });
  mocks.rpc.mockImplementation(async (name) =>
    name === "weekly_ranking" ? { entries: [], currentUser: null } : {},
  );
  const response = await handler(
    new Request("http://localhost/api/ranking/weekly"),
  );
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("weekly_ranking", {
    p_user: "visitor",
  });
});
it("does not report an achievement purchase as successful", async () => {
  mocks.rpc.mockImplementation(async (name) => {
    if (name === "shop_purchase")
      throw new ApiError("item_not_purchasable", 409);
    return {};
  });
  const response = await purchase({
    itemId: "frame-champion",
    expectedPrice: 0,
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    error: { code: "item_not_purchasable" },
  });
  expect(mocks.rpc.mock.calls.some(([name]) => name === "shop_state")).toBe(
    false,
  );
});
