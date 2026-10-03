import { describe, expect, test } from "vitest";
import {
  completionCoins,
  guestShop,
  itemPrice,
  milestoneItemIds,
  SHOP_ITEMS,
  streakReward,
  weeklyOffer,
} from "./economy";

describe("study economy", () => {
  test("rewards only distinct completions and every crossed level", () => {
    expect(completionCoins(true, 0, 0)).toBe(10);
    expect(completionCoins(true, 0, 3)).toBe(85);
    expect(completionCoins(false, 0, 3)).toBe(0);
    expect(completionCoins(true, 3, 2)).toBe(10);
    expect(() => completionCoins(true, -1, 2)).toThrow();
    expect(() => completionCoins(true, 0, Number.MAX_SAFE_INTEGER)).toThrow();
  });
  test("streak rewards occur at exact milestones rather than every later day", () => {
    expect([6, 7, 8, 29, 30, 31].map(streakReward)).toEqual([
      0, 50, 0, 0, 200, 0,
    ]);
    expect(() => streakReward(1.5)).toThrow();
    expect(milestoneItemIds(4, 29)).toEqual([]);
    expect(milestoneItemIds(5, 30)).toEqual(["avatar-scholar", "avatar-flame"]);
  });
  test("weekly offers rotate exactly Monday UTC and never discount consumable hints", () => {
    const before = weeklyOffer(new Date("2026-10-04T23:59:59.999Z"));
    const after = weeklyOffer(new Date("2026-10-05T00:00:00.000Z"));
    expect(before.endsAt).toBe(after.startsAt);
    expect(after.itemId).not.toBe(before.itemId);
    expect(after.startsAt).toBe("2026-10-05T00:00:00.000Z");
    expect(after.endsAt).toBe("2026-10-12T00:00:00.000Z");
    expect(weeklyOffer(new Date("2026-10-11T23:59:59.999Z"))).toEqual(after);
    const item = SHOP_ITEMS.find((entry) => entry.id === after.itemId)!;
    expect(item.kind).not.toBe("hint");
    expect(itemPrice(item, new Date(after.startsAt))).toBe(
      Math.max(100, Math.floor(item.price * 0.8)),
    );
    expect(itemPrice(SHOP_ITEMS[0], new Date(after.startsAt))).toBe(30);
    for (let week = 0; week < 8; week++) {
      const offer = weeklyOffer(new Date(Date.UTC(2026, 9, 5 + week * 7)));
      expect(offer.price).toBeGreaterThanOrEqual(100);
    }
    expect(() => weeklyOffer(new Date("invalid"))).toThrow();
  });
  test("exploration has a public catalog without invented ownership or currency", () => {
    const state = guestShop();
    expect(state.coins).toBe(0);
    expect(state.ownedItemIds).toEqual([]);
    expect(Object.values(state.equipped)).toEqual([null, null, null]);
    state.items[0].price = 0;
    expect(SHOP_ITEMS[0].price).toBe(30);
    expect(new Set(SHOP_ITEMS.map((item) => item.id)).size).toBe(
      SHOP_ITEMS.length,
    );
    expect(
      SHOP_ITEMS.filter((item) => item.kind !== "hint").every(
        (item) => item.price >= 100,
      ),
    ).toBe(true);
  });
});
