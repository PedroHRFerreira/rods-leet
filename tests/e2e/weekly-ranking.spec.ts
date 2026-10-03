import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { guestDashboard } from "../../src/lib/gateway";
import { guestShop, studyPeriods } from "../../src/domain/economy";
import type {
  WeeklyRankingEntry,
  WeeklyRankingState,
} from "../../src/lib/contracts";

let server: ChildProcess;
let baseURL: string;
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ playwright }, info) => {
  void playwright;
  const port = info.project.name === "mobile" ? 5205 : 5204;
  baseURL = `http://127.0.0.1:${port}`;
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      env: {
        ...process.env,
        VITE_BFF_ENABLED: "true",
        VITE_EMAIL_REGISTRATION_ENABLED: "false",
      },
      stdio: "inherit",
    },
  );
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(baseURL)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(200);
});
test.afterAll(() => server?.kill());

async function setup(
  page: Page,
  options: {
    eligible?: boolean;
    anonymous?: boolean;
    empty?: boolean;
    failure?: boolean;
  } = {},
) {
  const shop = guestShop();
  shop.coins = 1200;
  shop.missions = shop.missions?.map((mission) => ({
    ...mission,
    eligible: !options.anonymous,
    progress: mission.id === "daily" ? 2 : 5,
  }));
  shop.ownedItemIds = [
    "avatar-dragon",
    "frame-vine",
    "name-emerald",
    "title-curious",
    "theme-forest",
    "title-forest",
  ];
  shop.equipped = {
    avatarId: "avatar-dragon",
    frameId: "frame-vine",
    nameColorId: "name-emerald",
    titleId: "title-curious",
    themeId: "theme-forest",
  };
  const entry: WeeklyRankingEntry = {
    userId: "learner",
    displayName: "Luna",
    avatarId: "avatar-dragon",
    frameId: "frame-vine",
    titleId: "title-curious",
    nameColorId: "name-emerald",
    xp: 5250,
    completedCount: 32,
    reachedAt: new Date().toISOString(),
    weeklyXp: 420,
    weeklyCompletedCount: 4,
    isCurrentUser: true,
    eligible: options.eligible ?? true,
  };
  const weekly: WeeklyRankingState = {
    ...studyPeriods().weekly,
    entries: options.empty || !entry.eligible ? [] : [entry],
    currentUser: options.anonymous ? null : entry,
    lastCompleted: {
      startsAt: new Date(
        Date.parse(studyPeriods().weekly.startsAt) - 7 * 86400000,
      ).toISOString(),
      endsAt: studyPeriods().weekly.startsAt,
      winners: options.empty
        ? []
        : [
            {
              ...entry,
              position: 1,
              coinsAwarded: 500,
              itemId: "frame-champion",
            },
          ],
    },
  };
  let failure = options.failure ?? false;
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session")
      return route.fulfill({ json: { user: { id: "learner" }, csrf: "csrf" } });
    if (path === "/api/dashboard")
      return route.fulfill({
        json: {
          ...guestDashboard(),
          profile: {
            id: "learner",
            displayName: "Luna",
            authenticated: true,
            anonymous: options.anonymous ?? false,
            ...shop.equipped,
          },
          xp: entry.xp,
          level: 7,
          completedCount: 32,
          coins: shop.coins,
        },
      });
    if (path === "/api/shop") return route.fulfill({ json: shop });
    if (path === "/api/ranking/weekly")
      return failure
        ? route.fulfill({
            status: 503,
            json: {
              error: {
                code: "unavailable",
                message: "Ranking temporariamente indisponível.",
              },
            },
          })
        : route.fulfill({ json: weekly });
    if (path === "/api/ranking") return route.fulfill({ json: [entry] });
    return route.fulfill({ json: [] });
  });
  return {
    shop,
    weekly,
    recover: () => {
      failure = false;
    },
  };
}
async function fits(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        (width) => document.documentElement.scrollWidth <= width + 1,
        page.viewportSize()!.width,
      ),
    )
    .toBe(true);
}

test("weekly eligibility, closed awards and total ranking remain separate", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`${baseURL}/ranking`);
  await expect(page.locator(".ranking-hero")).toContainText(
    "Você está disputando a premiação",
  );
  await expect(page.locator(".ranking-table")).toContainText("420");
  await expect(page.locator(".ranking-table")).not.toContainText("5.250");
  await expect(page.locator(".weekly-prize")).toHaveCount(5);
  await expect(page.locator(".weekly-winner-list")).toContainText(
    "500 moedas entregues",
  );
  await page.getByRole("button", { name: "Geral", exact: true }).click();
  await expect(page.locator(".ranking-table")).toContainText("5.250");
  await expect(page.locator(".weekly-prizes")).toHaveCount(0);
  await fits(page);
});

test("ineligible and empty closed weeks clearly explain the missing awards", async ({
  page,
}) => {
  await setup(page, { eligible: false, empty: true });
  await page.goto(`${baseURL}/ranking`);
  await expect(page.locator(".ranking-hero")).toContainText(
    "Complete pelo menos 3 desafios",
  );
  await expect(
    page.getByRole("heading", {
      name: "Nenhum participante elegível nesta semana",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Nenhuma conta elegível nesse período; não houve entrega de prêmios.",
    ),
  ).toBeVisible();
});

test("weekly failure has a working retry", async ({ page }, info) => {
  const state = await setup(page, { failure: true });
  await page.goto(`${baseURL}/ranking`);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.screenshot({
    path: `/tmp/rods-weekly-error-${info.project.name}.png`,
    fullPage: true,
  });
  state.recover();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.locator(".ranking-table tbody tr")).toHaveCount(1);
});

test("shop and weekly layouts fit 320, 390, 800 and 1440 pixels with keyboard preview", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 800, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(`${baseURL}/loja`);
    await expect(page.locator(".shop-collection")).toHaveCount(3);
    await expect(page.locator(".shop-collection-forest")).toContainText(
      "Título recebido",
    );
    await expect(page.locator(".shop-offer-grid .shop-offer")).toHaveCount(3);
    await fits(page);
    if (width === 390 || width === 1440) {
      await page.screenshot({
        path: `/tmp/rods-shop-v2-final-${width}-${info.project.name}.png`,
        fullPage: true,
      });
      await page.locator(".shop-weekly-offers").screenshot({
        path: `/tmp/rods-shop-v2-offers-${width}-${info.project.name}.png`,
      });
      await page.locator(".shop-collections").screenshot({
        path: `/tmp/rods-shop-v2-collections-${width}-${info.project.name}.png`,
      });
    }
    await page.locator(".shop-personal-preview").screenshot({
      path: `/tmp/rods-shop-preview-${width}-${info.project.name}.png`,
    });
    const preview = page.getByRole("button", {
      name: "Ver prévia de Pixels clássicos",
      exact: true,
    });
    await preview.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", {
        name: "Prévia: Pixels clássicos",
        exact: true,
      }),
    ).toBeFocused();
    await expect(
      page.locator(".shop-preview-profile .cosmetic-frame-pixel"),
    ).toBeVisible();
    await page.goto(`${baseURL}/ranking`);
    await expect(page.locator(".weekly-prize")).toHaveCount(5);
    await fits(page);
    await page.screenshot({
      path: `/tmp/rods-weekly-${width}-${info.project.name}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("all theme palettes preserve light preference and readable name colors", async ({
  page,
}, info) => {
  const state = await setup(page);
  const backgrounds = new Set<string>();
  async function checkContrast() {
    const ratios = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      function luminance(value: string) {
        const hex = value.trim().replace("#", "");
        const normalized =
          hex.length === 3 ? [...hex].map((char) => char + char).join("") : hex;
        const channels = [0, 2, 4]
          .map(
            (start) => parseInt(normalized.slice(start, start + 2), 16) / 255,
          )
          .map((channel) =>
            channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4,
          );
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      }
      const background = luminance(style.getPropertyValue("--panel"));
      return [
        "--cosmetic-name-cyan",
        "--cosmetic-name-violet",
        "--cosmetic-name-lime",
        "--cosmetic-name-rose",
        "--cosmetic-name-emerald",
        "--accent",
      ].map((name) => {
        const foreground = luminance(style.getPropertyValue(name));
        return (
          (Math.max(background, foreground) + 0.05) /
          (Math.min(background, foreground) + 0.05)
        );
      });
    });
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
  for (const theme of ["ocean", "sunset", "neon", "cosmos", "forest"]) {
    state.shop.equipped.themeId = `theme-${theme}`;
    await page.goto(`${baseURL}/perfil`);
    await expect(page.locator("html")).toHaveAttribute(
      "data-cosmetic-theme",
      theme,
    );
    await expect(
      page.locator(".profile-large-avatar .cosmetic-frame-vine"),
    ).toBeVisible();
    await expect(page.locator(".profile-identity")).toContainText(
      "Pessoa curiosa",
    );
    const dark = await page
      .locator("html")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    backgrounds.add(dark);
    await checkContrast();
    await page.screenshot({
      path: `/tmp/rods-palette-${theme}-dark-${info.project.name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Ativar tema claro", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(
      await page
        .locator("html")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).not.toBe(dark);
    await fits(page);
    await checkContrast();
    await page.screenshot({
      path: `/tmp/rods-palette-${theme}-light-${info.project.name}.png`,
      fullPage: true,
    });
    if (theme === "forest")
      await page.screenshot({
        path: `/tmp/rods-profile-forest-light-${info.project.name}.png`,
        fullPage: true,
      });
    await page
      .getByRole("button", { name: "Ativar tema escuro", exact: true })
      .click();
  }
  expect(backgrounds.size).toBe(5);
  await page.goto(`${baseURL}/loja`);
  await expect(page.locator(".shop-grid .cosmetic-frame")).toHaveCount(9);
  const silhouettes = await page
    .locator(".shop-grid .cosmetic-frame")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return [
          style.borderRadius,
          style.borderTopStyle,
          style.borderTopColor,
        ].join("/");
      }),
    );
  expect(new Set(silhouettes).size).toBe(9);
});
