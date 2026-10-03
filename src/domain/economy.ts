import type {
  ShopItem,
  ShopOffer,
  ShopState,
  StudyMission,
} from "../lib/contracts";

export const ECONOMY_RULES = Object.freeze({
  completionCoins: 10,
  levelCoins: 25,
  hintPrice: 30,
  streak7Coins: 50,
  streak30Coins: 200,
  dailyMissionTarget: 3,
  dailyMissionCoins: 20,
  weeklyMissionTarget: 7,
  weeklyMissionCoins: 75,
});

export { SHOP_ITEMS, SHOP_COLLECTIONS, WEEKLY_PRIZES } from "./shop-catalog";
import { SHOP_ITEMS, SHOP_COLLECTIONS } from "./shop-catalog";

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;
const MONDAY_EPOCH = Date.UTC(1970, 0, 5);
const LOCAL_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
function localParts(date: Date) {
  if (!Number.isFinite(date.getTime())) throw new Error("Data inválida");
  return Object.fromEntries(
    LOCAL_FORMAT.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}
function localMidnight(calendarDay: number): number {
  let time = calendarDay;
  // Resolve the named timezone rather than treating every historic date as UTC-3.
  for (let iteration = 0; iteration < 3; iteration++) {
    const p = localParts(new Date(time));
    const localTime = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      p.second,
    );
    const correction = calendarDay - localTime;
    if (correction === 0) break;
    time += correction;
  }
  return time;
}
export interface StudyPeriods {
  daily: { startsAt: string; endsAt: string };
  weekly: { startsAt: string; endsAt: string };
}
/** Half-open periods beginning at local midnight in America/Sao_Paulo. */
export function studyPeriods(date: Date = new Date()): StudyPeriods {
  const p = localParts(date);
  const day = Date.UTC(p.year, p.month - 1, p.day);
  const weekday = new Date(day).getUTCDay();
  const monday = day - ((weekday + 6) % 7) * DAY_MS;
  const period = (start: number, end: number) => ({
    startsAt: new Date(localMidnight(start)).toISOString(),
    endsAt: new Date(localMidnight(end)).toISOString(),
  });
  return {
    daily: period(day, day + DAY_MS),
    weekly: period(monday, monday + WEEK_MS),
  };
}
/** Three purchase-only cosmetic discounts, stable throughout the local study week. */
export function weeklyOffers(date: Date = new Date()): ShopOffer[] {
  const period = studyPeriods(date).weekly;
  const p = localParts(new Date(period.startsAt));
  const calendarStart = Date.UTC(p.year, p.month - 1, p.day);
  const week = Math.floor((calendarStart - MONDAY_EPOCH) / WEEK_MS);
  const candidates = SHOP_ITEMS.filter(
    (item) => item.kind !== "hint" && item.acquisition === "purchase",
  );
  const index =
    ((week % candidates.length) + candidates.length) % candidates.length;
  return Array.from({ length: Math.min(3, candidates.length) }, (_, offset) => {
    const item = candidates[(index + offset) % candidates.length];
    return {
      itemId: item.id,
      price: Math.max(1, Math.floor(item.price * 0.8)),
      ...period,
    };
  });
}
/** Compatibility projection for clients supporting only one offer. */
export function weeklyOffer(date: Date = new Date()): ShopOffer {
  return weeklyOffers(date)[0];
}
export function itemPrice(item: ShopItem, date: Date = new Date()): number {
  return (
    weeklyOffers(date).find((offer) => offer.itemId === item.id)?.price ??
    item.price
  );
}
/** Compute only from trusted post-publication distinct completion evidence. Claims are persisted by the server. */
export function studyMissions(
  input: {
    registered: boolean;
    dailyCompletionIds: readonly string[];
    weeklyCompletionIds: readonly string[];
    dailyClaimed?: boolean;
    weeklyClaimed?: boolean;
  },
  date: Date = new Date(),
): StudyMission[] {
  const periods = studyPeriods(date);
  return [
    {
      id: "daily",
      target: ECONOMY_RULES.dailyMissionTarget,
      coins: ECONOMY_RULES.dailyMissionCoins,
      progress: Math.min(3, new Set(input.dailyCompletionIds).size),
      claimed: input.dailyClaimed ?? false,
      eligible: input.registered,
      ...periods.daily,
    },
    {
      id: "weekly",
      target: ECONOMY_RULES.weeklyMissionTarget,
      coins: ECONOMY_RULES.weeklyMissionCoins,
      progress: Math.min(7, new Set(input.weeklyCompletionIds).size),
      claimed: input.weeklyClaimed ?? false,
      eligible: input.registered,
      ...periods.weekly,
    },
  ];
}
/** Award only on the server, to registered accounts, merging permanent ownership atomically. */
export function collectionRewardItemIds(
  ownedItemIds: readonly string[],
): string[] {
  const owned = new Set(ownedItemIds);
  return SHOP_COLLECTIONS.filter(
    (collection) =>
      !owned.has(collection.rewardItemId) &&
      collection.itemIds.every((id) => owned.has(id)),
  ).map((collection) => collection.rewardItemId);
}

function validCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error("Contagem inválida");
}

/** Call only on server-confirmed first completion, never on a replay. */
export function completionCoins(
  firstCompletion: boolean,
  previousLevel: number,
  nextLevel: number,
): number {
  validCount(previousLevel);
  validCount(nextLevel);
  if (!firstCompletion) return 0;
  const result =
    ECONOMY_RULES.completionCoins +
    Math.max(0, nextLevel - previousLevel) * ECONOMY_RULES.levelCoins;
  if (!Number.isSafeInteger(result)) throw new Error("Recompensa inválida");
  return result;
}

/** Persistence must claim each milestone once per streak, using its start date. */
export function streakReward(days: number): number {
  validCount(days);
  return days === 7
    ? ECONOMY_RULES.streak7Coins
    : days === 30
      ? ECONOMY_RULES.streak30Coins
      : 0;
}

/** Gifts are permanent; merge with owned IDs instead of granting duplicates. */
export function milestoneItemIds(level: number, streakDays: number): string[] {
  validCount(level);
  validCount(streakDays);
  return [
    ...(level >= 5 ? ["avatar-scholar"] : []),
    ...(streakDays >= 30 ? ["avatar-flame"] : []),
  ];
}

export function guestShop(date: Date = new Date()): ShopState {
  return {
    coins: 0,
    items: structuredClone([...SHOP_ITEMS]),
    ownedItemIds: [],
    equipped: {
      avatarId: null,
      nameColorId: null,
      themeId: null,
      frameId: null,
      titleId: null,
    },
    offer: weeklyOffer(date),
    offers: weeklyOffers(date),
    collections: structuredClone([...SHOP_COLLECTIONS]),
    missions: studyMissions(
      { registered: false, dailyCompletionIds: [], weeklyCompletionIds: [] },
      date,
    ),
  };
}
