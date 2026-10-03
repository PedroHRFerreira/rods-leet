import type { ShopItem, ShopOffer, ShopState } from "../lib/contracts";

export const ECONOMY_RULES = Object.freeze({
  completionCoins: 10,
  levelCoins: 25,
  hintPrice: 30,
  streak7Coins: 50,
  streak30Coins: 200,
});

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: "hint-extra",
    name: "Dica extra",
    description: "Uma dica adicional. O uso mantém a redução de XP do desafio.",
    kind: "hint",
    price: 30,
    minLevel: 0,
    value: "1",
  },
  {
    id: "avatar-robot",
    name: "Robô explorador",
    description: "Um companheiro para suas descobertas.",
    kind: "avatar",
    price: 100,
    minLevel: 0,
    value: "🤖",
  },
  {
    id: "avatar-fox",
    name: "Raposa curiosa",
    description: "Curiosidade em cada desafio.",
    kind: "avatar",
    price: 150,
    minLevel: 2,
    value: "🦊",
  },
  {
    id: "avatar-scholar",
    name: "Coruja sábia",
    description: "Presente ao alcançar o nível 5.",
    kind: "avatar",
    price: 250,
    minLevel: 5,
    value: "🦉",
  },
  {
    id: "avatar-flame",
    name: "Chama constante",
    description: "Presente por uma sequência de 30 dias.",
    kind: "avatar",
    price: 300,
    minLevel: 5,
    value: "🔥",
  },
  {
    id: "name-cyan",
    name: "Nome ciano",
    description: "Dê uma nova cor ao seu nome.",
    kind: "name_color",
    price: 100,
    minLevel: 0,
    value: "#22d3ee",
  },
  {
    id: "name-violet",
    name: "Nome violeta",
    description: "Uma cor exclusiva a partir do nível 3.",
    kind: "name_color",
    price: 150,
    minLevel: 3,
    value: "#c4b5fd",
  },
  {
    id: "theme-ocean",
    name: "Oceano",
    description: "Tons profundos de azul e ciano.",
    kind: "theme",
    price: 200,
    minLevel: 2,
    value: "ocean",
  },
  {
    id: "theme-sunset",
    name: "Pôr do sol",
    description: "Tons quentes para acompanhar seus estudos.",
    kind: "theme",
    price: 250,
    minLevel: 5,
    value: "sunset",
  },
];

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;
const MONDAY_EPOCH = Date.UTC(1970, 0, 5);

/** Stable across clients and servers, rotating each Monday at 00:00 UTC. */
export function weeklyOffer(date: Date = new Date()): ShopOffer {
  const time = date.getTime();
  if (!Number.isFinite(time)) throw new Error("Data inválida");
  const week = Math.floor((time - MONDAY_EPOCH) / WEEK_MS);
  const candidates = SHOP_ITEMS.filter((item) => item.kind !== "hint");
  const index =
    ((week % candidates.length) + candidates.length) % candidates.length;
  const item = candidates[index];
  const start = MONDAY_EPOCH + week * WEEK_MS;
  return {
    itemId: item.id,
    price: Math.max(100, Math.floor(item.price * 0.8)),
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + WEEK_MS).toISOString(),
  };
}

export function itemPrice(item: ShopItem, date: Date = new Date()): number {
  const offer = weeklyOffer(date);
  return item.id === offer.itemId ? offer.price : item.price;
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
    equipped: { avatarId: null, nameColorId: null, themeId: null },
    offer: weeklyOffer(date),
  };
}
