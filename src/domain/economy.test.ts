import { describe, expect, test } from "vitest";
import {
  completionCoins,
  guestShop,
  itemPrice,
  milestoneItemIds,
  SHOP_ITEMS,
  streakReward,
  weeklyOffer,
  weeklyOffers,
  studyPeriods,
  studyMissions,
  collectionRewardItemIds,
  SHOP_COLLECTIONS,
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
  test("weekly offers rotate at Monday midnight Sao Paulo and always discount purchasable cosmetics", () => {
    const before = weeklyOffers(new Date("2026-10-05T02:59:59.999Z"));
    const after = weeklyOffers(new Date("2026-10-05T03:00:00.000Z"));
    expect(after).toHaveLength(3);
    expect(new Set(after.map((offer) => offer.itemId)).size).toBe(3);
    expect(before[0].endsAt).toBe(after[0].startsAt);
    expect(after[0].startsAt).toBe("2026-10-05T03:00:00.000Z");
    expect(after[0].endsAt).toBe("2026-10-12T03:00:00.000Z");
    expect(after.map((offer) => offer.itemId)).not.toEqual(
      before.map((offer) => offer.itemId),
    );
    expect(weeklyOffers(new Date("2026-10-12T02:59:59.999Z"))).toEqual(after);
    expect(weeklyOffer(new Date(after[0].startsAt))).toEqual(after[0]);
    for (let week = 0; week < SHOP_ITEMS.length; week++) {
      const date = new Date(Date.UTC(2026, 9, 5 + week * 7, 3));
      for (const offer of weeklyOffers(date)) {
        const item = SHOP_ITEMS.find((entry) => entry.id === offer.itemId)!;
        expect(item.acquisition).toBe("purchase");
        expect(item.kind).not.toBe("hint");
        expect(offer.price).toBeGreaterThan(0);
        expect(offer.price).toBeLessThan(item.price);
        expect(itemPrice(item, date)).toBe(offer.price);
      }
    }
    expect(itemPrice(SHOP_ITEMS[0], new Date(after[0].startsAt))).toBe(30);
    expect(() => weeklyOffers(new Date("invalid"))).toThrow();
  });
  test("daily and weekly periods include local midnight and exclude the next boundary", () => {
    const sunday = studyPeriods(new Date("2026-10-05T02:59:59.999Z"));
    const monday = studyPeriods(new Date("2026-10-05T03:00:00Z"));
    expect(sunday.daily.endsAt).toBe(monday.daily.startsAt);
    expect(sunday.weekly.endsAt).toBe(monday.weekly.startsAt);
    expect(monday.daily).toEqual({
      startsAt: "2026-10-05T03:00:00.000Z",
      endsAt: "2026-10-06T03:00:00.000Z",
    });
    // Named timezone also accounts for the historical daylight-saving offset.
    expect(studyPeriods(new Date("2018-12-03T12:00:00Z")).weekly.startsAt).toBe(
      "2018-12-03T02:00:00.000Z",
    );
  });
  test("mission evidence counts distinct IDs and visitors are ineligible", () => {
    const visitor = studyMissions({
      registered: false,
      dailyCompletionIds: ["a", "a", "b"],
      weeklyCompletionIds: ["a", "a"],
    });
    expect(visitor.map((mission) => mission.progress)).toEqual([2, 1]);
    expect(
      visitor.every((mission) => !mission.eligible && !mission.claimed),
    ).toBe(true);
    const registered = studyMissions({
      registered: true,
      dailyCompletionIds: ["a", "b", "c", "d"],
      weeklyCompletionIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
      dailyClaimed: true,
    });
    expect(
      registered.map(({ target, progress, coins, eligible, claimed }) => ({
        target,
        progress,
        coins,
        eligible,
        claimed,
      })),
    ).toEqual([
      { target: 3, progress: 3, coins: 20, eligible: true, claimed: true },
      { target: 7, progress: 7, coins: 75, eligible: true, claimed: false },
    ]);
  });
  test("collection rewards require every purchase and exclude previously owned gifts", () => {
    const collection = SHOP_COLLECTIONS[0];
    expect(collectionRewardItemIds(collection.itemIds.slice(1))).toEqual([]);
    expect(collectionRewardItemIds(collection.itemIds)).toEqual([
      collection.rewardItemId,
    ]);
    expect(
      collectionRewardItemIds([...collection.itemIds, collection.rewardItemId]),
    ).toEqual([]);
    expect(
      collectionRewardItemIds(
        SHOP_COLLECTIONS.flatMap((entry) => entry.itemIds),
      ),
    ).toEqual(SHOP_COLLECTIONS.map((entry) => entry.rewardItemId));
  });
  test("catalog has discounted hint packs, exclusive rewards and at least 24 cosmetic purchases", () => {
    const singles = SHOP_ITEMS.find((item) => item.id === "hint-extra")!;
    for (const [id, count, price] of [
      ["hint-pack3", 3, 75],
      ["hint-pack10", 10, 220],
    ] as const) {
      const pack = SHOP_ITEMS.find((item) => item.id === id)!;
      expect(pack.hintCount).toBe(count);
      expect(pack.price).toBe(price);
      expect(pack.price).toBeLessThan(singles.price * count);
    }
    expect(
      SHOP_ITEMS.filter(
        (item) => item.acquisition === "purchase" && item.kind !== "hint",
      ).length,
    ).toBeGreaterThanOrEqual(24);
    expect(
      SHOP_ITEMS.filter((item) => item.acquisition !== "purchase").every(
        (item) => item.price === 0,
      ),
    ).toBe(true);
    expect(
      SHOP_ITEMS.filter((item) => item.acquisition === "ranking"),
    ).toHaveLength(5);
    for (const collection of SHOP_COLLECTIONS) {
      expect(collection.itemIds).toHaveLength(4);
      expect(
        collection.itemIds.every((id) =>
          SHOP_ITEMS.some(
            (item) =>
              item.id === id &&
              item.collectionId === collection.id &&
              item.acquisition === "purchase",
          ),
        ),
      ).toBe(true);
      expect(
        SHOP_ITEMS.find((item) => item.id === collection.rewardItemId)
          ?.acquisition,
      ).toBe("collection");
    }
  });
  test("exploration has a public catalog without invented ownership or currency", () => {
    const state = guestShop();
    expect(state.coins).toBe(0);
    expect(state.ownedItemIds).toEqual([]);
    expect(Object.values(state.equipped)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(
      state.missions?.every(
        (mission) =>
          mission.progress === 0 && !mission.eligible && !mission.claimed,
      ),
    ).toBe(true);
    state.items[0].price = 0;
    expect(SHOP_ITEMS[0].price).toBe(30);
    expect(new Set(SHOP_ITEMS.map((item) => item.id)).size).toBe(
      SHOP_ITEMS.length,
    );
    expect(
      SHOP_ITEMS.filter(
        (item) => item.kind !== "hint" && item.acquisition === "purchase",
      ).every((item) => item.price >= 100),
    ).toBe(true);
  });
});
