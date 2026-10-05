import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { guestDashboard } from "../../src/lib/gateway";
import { guestShop } from "../../src/domain/economy";
import { challenges } from "../../src/content/catalog";

let server: ChildProcess;
let baseURL: string;
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ playwright }, info) => {
  void playwright;
  const port = info.project.name === "mobile" ? 5197 : 5196;
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
        VITE_EMAIL_REGISTRATION_ENABLED: "true",
        VITE_GOOGLE_LOGIN_ENABLED: "true",
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
    anonymous?: boolean;
    dropPurchase?: boolean;
    loginError?: boolean;
    googleError?: boolean;
    waitForGoogle?: boolean;
    rejectPurchase?: boolean;
    purchaseRefetchError?: boolean;
  } = {},
) {
  const shop = guestShop();
  shop.coins = 500;
  let anonymous = options.anonymous ?? false;
  let userId = anonymous ? "visitor" : "learner";
  let hints = 1;
  const purchases: Array<{ key: string; body: Record<string, unknown> }> = [];
  const authCalls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const googleCalls: Array<{ method: string; csrf: string | undefined }> = [];
  let releaseGoogle = () => {};
  const googleGate = options.waitForGoogle
    ? new Promise<void>((resolve) => {
        releaseGoogle = resolve;
      })
    : Promise.resolve();
  const applied = new Set<string>();
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session")
      return route.fulfill({ json: { user: { id: userId }, csrf: "csrf" } });
    if (
      options.purchaseRefetchError &&
      applied.size > 0 &&
      (path === "/api/dashboard" || path === "/api/shop")
    )
      return route.fulfill({
        status: 503,
        json: { error: { code: "service_unavailable" } },
      });
    if (path === "/api/dashboard")
      return route.fulfill({
        json: {
          ...guestDashboard(),
          profile: {
            id: userId,
            displayName: "Luna",
            authenticated: true,
            anonymous,
            ...shop.equipped,
          },
          level: 5,
          xp: 2250,
          coins: shop.coins,
          hintBalance: hints,
        },
      });
    if (path === "/api/shop/purchase") {
      const body = route.request().postDataJSON();
      const key = route.request().headers()["idempotency-key"];
      purchases.push({ key, body });
      if (options.rejectPurchase)
        return route.fulfill({
          status: 409,
          json: { error: { code: "insufficient_coins" } },
        });
      if (!applied.has(key)) {
        applied.add(key);
        shop.coins -= Number(body.expectedPrice);
        if (body.itemId.startsWith("hint-"))
          hints +=
            shop.items.find((item) => item.id === body.itemId)?.hintCount ?? 1;
        else shop.ownedItemIds.push(body.itemId);
      }
      if (options.dropPurchase && purchases.length === 1) return route.abort();
      return route.fulfill({ json: shop });
    }
    if (path === "/api/shop/equip") {
      const { itemId } = route.request().postDataJSON();
      if (itemId.startsWith("avatar-"))
        shop.equipped.avatarId = itemId === "avatar-default" ? null : itemId;
      if (itemId.startsWith("theme-"))
        shop.equipped.themeId = itemId === "theme-default" ? null : itemId;
      if (itemId.startsWith("frame-"))
        shop.equipped.frameId = itemId === "frame-default" ? null : itemId;
      if (itemId.startsWith("title-"))
        shop.equipped.titleId = itemId === "title-default" ? null : itemId;
      return route.fulfill({ json: shop });
    }
    if (path === "/api/shop") return route.fulfill({ json: shop });
    return route.fulfill({
      json: path === "/api/challenges" ? challenges : [],
    });
  });
  await page.route("**/auth/**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const path = new URL(route.request().url()).pathname;
    authCalls.push({ path, body: route.request().postDataJSON() });
    if (path === "/auth/start") {
      googleCalls.push({
        method: route.request().method(),
        csrf: route.request().headers()["x-csrf-token"],
      });
      await googleGate;
      return options.googleError
        ? route.fulfill({
            status: 429,
            json: { error: { code: "rate_limited" } },
          })
        : route.fulfill({
            json: {
              url: "https://bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/authorize?provider=google",
            },
          });
    }
    if (path === "/auth/login" && options.loginError)
      return route.fulfill({
        status: 401,
        json: { error: { code: "authentication_failed" } },
      });
    if (path === "/auth/login" || path === "/auth/confirm") {
      anonymous = false;
      userId = "learner";
    }
    return route.fulfill({
      json:
        path === "/auth/signup"
          ? { requiresEmailConfirmation: true }
          : { ok: true },
    });
  });
  return { shop, purchases, authCalls, googleCalls, releaseGoogle };
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("purchase lost reply retries the same key, equips and restores an avatar", async ({
  page,
}, info) => {
  const state = await setup(page, { dropPurchase: true });
  await page.goto(`${baseURL}/loja`);
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Robô explorador" }) });
  await card.getByRole("button", { name: "Comprar", exact: true }).click();
  await page.getByRole("button", { name: /Comprar por/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: `/tmp/rods-shop-error-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Tentar esta operação novamente" })
    .click();
  const celebration = page.getByRole("dialog");
  await expect(celebration).toContainText("Compra confirmada");
  await expect(
    celebration.getByRole("heading", { name: "Robô explorador", exact: true }),
  ).toBeVisible();
  await celebration.getByRole("button", { name: "Continuar na loja" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "adicionado ao inventário" }),
  ).toBeVisible();
  expect(state.purchases).toHaveLength(2);
  expect(state.purchases[0]).toEqual(state.purchases[1]);
  expect(state.shop.coins).toBe(
    500 - Number(state.purchases[0].body.expectedPrice),
  );
  await card.getByRole("button", { name: "Equipar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar e equipar" }).click();
  await expect(
    card.getByRole("button", { name: "Equipado", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /Meu inventário/ }).click();
  await page.getByRole("button", { name: "Restaurar avatar padrão" }).click();
  await page.getByRole("button", { name: "Confirmar e equipar" }).click();
  await expect.poll(() => state.shop.equipped.avatarId).toBeNull();
  await fits(page);
  await page.screenshot({
    path: `/tmp/rods-shop-success-dark-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ativar tema claro", exact: true })
    .click();
  await page.screenshot({
    path: `/tmp/rods-shop-success-light-${info.project.name}.png`,
    fullPage: true,
  });
});
test("visitors preview the shop but cannot buy", async ({ page }) => {
  const state = await setup(page, { anonymous: true });
  await page.goto(`${baseURL}/loja`);
  await expect(
    page.getByRole("link", {
      name: /Entrar ou criar conta|Sobre sua conta/,
      exact: true,
    }),
  ).toBeVisible();
  for (const button of await page
    .getByRole("button", { name: "Disponível com sua conta" })
    .all())
    await expect(button).toBeDisabled();
  expect(state.purchases).toHaveLength(0);
  await expect(
    page.getByText(
      /Compras, equipagem, metas extras e prêmios semanais exigem conta/,
    ),
  ).toBeVisible();
  await fits(page);
});
test("registered hint packs confirm the discounted server price without granting a cosmetic", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(`${baseURL}/loja`);
  const card = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Pacote de 3 dicas",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Comprar", exact: true }).click();
  await page
    .getByRole("button", { name: "Comprar por 75 moedas", exact: true })
    .click();
  await expect.poll(() => state.purchases.length).toBe(1);
  expect(state.purchases[0].body).toEqual({
    itemId: "hint-pack3",
    expectedPrice: 75,
  });
  expect(state.shop.coins).toBe(425);
  expect(state.shop.ownedItemIds).not.toContain("hint-pack3");
  await expect(page.getByRole("dialog")).toContainText("3 dicas");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continuar na loja" })
    .click();
});
test("frames are previewed before purchase and equipped in a separate confirmed operation", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(`${baseURL}/loja`);
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Pixels clássicos", exact: true }),
  });
  await card
    .getByRole("button", {
      name: "Ver prévia de Pixels clássicos",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Prévia: Pixels clássicos",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.purchases).toHaveLength(0);
  expect(state.shop.equipped.frameId).toBeNull();
  await card.getByRole("button", { name: "Comprar", exact: true }).click();
  await page.getByRole("button", { name: /Comprar por/ }).click();
  await expect
    .poll(() => state.shop.ownedItemIds.includes("frame-pixel"))
    .toBe(true);
  expect(state.shop.equipped.frameId).toBeNull();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continuar na loja" })
    .click();
  await card.getByRole("button", { name: "Equipar", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar e equipar", exact: true })
    .click();
  await expect.poll(() => state.shop.equipped.frameId).toBe("frame-pixel");
});
test("confirmed purchases have a full-screen celebration with keyboard dismissal and no replay", async ({
  page,
}, info) => {
  const state = await setup(page);
  await page.goto(`${baseURL}/loja`);
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Astronauta", exact: true }),
  });
  await card.getByRole("button", { name: "Comprar", exact: true }).click();
  await page.getByRole("button", { name: /Comprar por/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Compra confirmada");
  await expect(
    dialog.getByRole("heading", { name: "Astronauta", exact: true }),
  ).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(
    true,
  );
  expect(
    await page.locator("body").evaluate((element) => element.style.overflow),
  ).toBe("hidden");
  const bounds = await dialog.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 2);
  expect(bounds?.height).toBeGreaterThanOrEqual(
    page.viewportSize()!.height - 2,
  );
  await fits(page);
  await expect(
    dialog.getByRole("button", { name: "Continuar na loja" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/rods-purchase-astronaut-${info.project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Equipar", exact: true }),
  ).toBeFocused();
  expect(
    await page.locator("body").evaluate((element) => element.style.overflow),
  ).toBe("");
  await page.getByRole("button", { name: /Meu inventário/ }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.purchases).toHaveLength(1);
  expect(state.shop.equipped.avatarId).toBeNull();
});
test("a confirmed celebration survives a failed dashboard and shop refresh", async ({
  page,
}) => {
  await setup(page, { purchaseRefetchError: true });
  await page.goto(`${baseURL}/loja`);
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Dica extra", exact: true }),
  });
  await card.getByRole("button", { name: "Comprar", exact: true }).click();
  await page.getByRole("button", { name: /Comprar por/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Compra confirmada");
  await expect(page.locator(".error-state")).toBeAttached();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Continuar na loja" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();
});
test("a rejected purchase never celebrates or changes the wallet", async ({
  page,
}) => {
  const state = await setup(page, { rejectPurchase: true });
  await page.goto(`${baseURL}/loja`);
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Robô explorador", exact: true }),
  });
  await card.getByRole("button", { name: "Comprar", exact: true }).click();
  await page.getByRole("button", { name: /Comprar por/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.shop.coins).toBe(500);
  expect(state.shop.ownedItemIds).not.toContain("avatar-robot");
});
test("every purchasable item has its own celebration and reduced motion stays still", async ({
  page,
}, info) => {
  const state = await setup(page);
  state.shop.coins = 20_000;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${baseURL}/loja`);
  const sceneIds = new Set<string>();
  for (const item of state.shop.items.filter(
    (entry) => entry.acquisition === "purchase",
  )) {
    const card = page.locator("article").filter({
      has: page.getByRole("heading", { name: item.name, exact: true }),
    });
    await card.getByRole("button", { name: "Comprar", exact: true }).click();
    await page.getByRole("button", { name: /Comprar por/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: item.name, exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Pular animação" }),
    ).toHaveCount(0);
    const sceneId = await dialog.getAttribute("data-scene");
    expect(sceneId).toBeTruthy();
    expect(sceneIds.has(sceneId!)).toBe(false);
    sceneIds.add(sceneId!);
    expect(
      await dialog.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);
    await fits(page);
    if (
      [
        "theme-ocean",
        "name-emerald",
        "title-debugger",
        "frame-neon",
        "hint-pack10",
      ].includes(item.id)
    )
      await page.screenshot({
        path: `/tmp/rods-purchase-${item.id}-${info.project.name}.png`,
      });
    await dialog.getByRole("button", { name: "Continuar na loja" }).click();
    await expect(dialog).toHaveCount(0);
  }
  expect(sceneIds.size).toBe(27);
  expect(state.purchases).toHaveLength(27);
});
test("finishing or skipping the reveal preserves keyboard focus and changing motion preference stops it", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`${baseURL}/loja`);
  for (const [name, finish] of [
    ["Dica extra", "timer"],
    ["Pacote de 3 dicas", "reduce"],
    ["Pacote de 10 dicas", "skip"],
  ]) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await card.getByRole("button", { name: "Comprar", exact: true }).click();
    await page.getByRole("button", { name: /Comprar por/ }).click();
    const dialog = page.getByRole("dialog");
    const skip = dialog.getByRole("button", { name: "Pular animação" });
    await expect(skip).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    if (finish === "reduce")
      await page.emulateMedia({ reducedMotion: "reduce" });
    if (finish === "skip") await page.keyboard.press("Enter");
    await expect(dialog).toHaveAttribute("data-phase", "settled");
    await expect(
      dialog.getByRole("button", { name: "Continuar na loja" }),
    ).toBeFocused();
    expect(
      await dialog.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
  }
});
test("celebrations fit small phones, tablets and large screens in the light theme", async ({
  page,
}, info) => {
  const state = await setup(page);
  state.shop.coins = 20_000;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${baseURL}/loja`);
  await page
    .getByRole("button", { name: "Ativar tema claro", exact: true })
    .click();
  for (const [width, height, itemName] of [
    [320, 568, "Pacote de 10 dicas"],
    [800, 900, "Nome esmeralda"],
    [1440, 900, "Cidade Neon"],
  ] as const) {
    await page.setViewportSize({ width, height });
    const card = page.locator("article").filter({
      has: page.getByRole("heading", { name: itemName, exact: true }),
    });
    await card.getByRole("button", { name: "Comprar", exact: true }).click();
    await page.getByRole("button", { name: /Comprar por/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await fits(page);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      (await dialog.locator(".purchase-celebration-confirmed").boundingBox())
        ?.y,
    ).toBeGreaterThanOrEqual(0);
    await dialog
      .getByRole("button", { name: "Continuar na loja" })
      .scrollIntoViewIfNeeded();
    await expect(
      dialog.getByRole("button", { name: "Continuar na loja" }),
    ).toBeInViewport();
    await page.screenshot({
      path: `/tmp/rods-purchase-light-${width}-${info.project.name}.png`,
    });
    await dialog.getByRole("button", { name: "Continuar na loja" }).click();
  }
});
test("email signup preserves visitor session and requests no password before confirmation", async ({
  page,
}, info) => {
  const state = await setup(page, { anonymous: true });
  await page.goto(`${baseURL}/conta`);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Nome de usuário").fill("Luna");
  await page.getByLabel("E-mail", { exact: true }).fill("luna@example.test");
  await page.getByRole("button", { name: "Enviar confirmação" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Enviamos um link" }),
  ).toBeVisible();
  expect(state.authCalls).toEqual([
    {
      path: "/auth/signup",
      body: {
        email: "luna@example.test",
        displayName: "Luna",
        returnTo: "/perfil",
      },
    },
  ]);
  await fits(page);
  await page.screenshot({
    path: `/tmp/rods-auth-signup-${info.project.name}.png`,
    fullPage: true,
  });
});
test("confirmation survives initial identity remount and sets password", async ({
  page,
}) => {
  const state = await setup(page, { anonymous: true });
  await page.goto(
    `${baseURL}/conta/confirmar?token_hash=${"ab".repeat(32)}&type=email_change`,
  );
  await expect(page).toHaveURL(`${baseURL}/conta/confirmar?returnTo=%2Fperfil`);
  // Wait on authenticated dashboard rendering so initial identity remount has completed.
  await expect(page.locator(".topbar-coins")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar e continuar" }).click();
  await expect(page).toHaveURL(`${baseURL}/conta/senha?returnTo=%2Fperfil`);
  await page.getByLabel(/^Nova senha/).fill("secure-password");
  await page.getByLabel("Repita a nova senha").fill("secure-password");
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page).toHaveURL(`${baseURL}/perfil`);
  expect(state.authCalls.map((c) => c.path)).toEqual([
    "/auth/confirm",
    "/auth/password",
  ]);
});
test("invalid email login stays on the page and keeps Google available", async ({
  page,
}, info) => {
  await setup(page, { anonymous: true, loginError: true });
  await page.goto(`${baseURL}/conta`);
  await page.getByLabel("E-mail", { exact: true }).fill("luna@example.test");
  await page.getByLabel(/^Senha/).fill("wrong-password");
  await page
    .locator("form")
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível validar",
  );
  await expect(page).toHaveURL(`${baseURL}/conta`);
  await expect(page.getByRole("button", { name: /Google/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /GitHub/ })).toHaveCount(0);
  await fits(page);
  await page.screenshot({
    path: `/tmp/rods-auth-error-${info.project.name}.png`,
    fullPage: true,
  });
});
test("Google login protects the request, blocks repeated clicks and redirects to the provider", async ({
  page,
}, info) => {
  const state = await setup(page, { anonymous: true, waitForGoogle: true });
  await page.route(
    "https://bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/authorize**",
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<main>Google authorization destination</main>",
      }),
  );
  await page.goto(`${baseURL}/conta`);
  const google = page.locator(".economy-auth-google button");
  await google.click();
  await expect(google).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Criar conta", exact: true }),
  ).toBeDisabled();
  expect(state.authCalls).toEqual([
    {
      path: "/auth/start",
      body: { provider: "google", returnTo: "/perfil", intent: "login" },
    },
  ]);
  expect(state.googleCalls).toEqual([{ method: "POST", csrf: "csrf" }]);
  await fits(page);
  await page.screenshot({
    path: `/tmp/rods-auth-google-pending-${info.project.name}.png`,
    fullPage: true,
  });
  state.releaseGoogle();
  await expect(page).toHaveURL(
    "https://bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/authorize?provider=google",
  );
});
test("Google rate limiting shows a recoverable error and leaves email access available", async ({
  page,
}, info) => {
  const state = await setup(page, { anonymous: true, googleError: true });
  await page.goto(`${baseURL}/conta`);
  const google = page.getByRole("button", { name: /Google/ });
  await google.click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível iniciar o login. Tente novamente.",
  );
  await expect(page).toHaveURL(`${baseURL}/conta`);
  await expect(google).toBeEnabled();
  await expect(page.getByLabel("E-mail", { exact: true })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Criar conta", exact: true }),
  ).toBeEnabled();
  await fits(page);
  await page.screenshot({
    path: `/tmp/rods-auth-google-error-${info.project.name}.png`,
    fullPage: true,
  });
  expect(state.googleCalls).toEqual([{ method: "POST", csrf: "csrf" }]);
});
test("Google remains available when email registration is disabled in production", async ({
  page,
}, info) => {
  const port = info.project.name === "mobile" ? 5207 : 5206;
  const googleOnlyURL = `http://127.0.0.1:${port}`;
  const googleOnlyServer = spawn(
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
        VITE_GOOGLE_LOGIN_ENABLED: "true",
      },
      stdio: "inherit",
    },
  );
  try {
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(googleOnlyURL)).status;
          } catch {
            return 0;
          }
        },
        { timeout: 30_000 },
      )
      .toBe(200);
    const state = await setup(page, { anonymous: true, googleError: true });
    await page.goto(`${googleOnlyURL}/conta`);
    await expect(
      page.getByRole("button", { name: "Criar conta", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".economy-auth-tabs button")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "Recuperar senha", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Enviar confirmação", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("E-mail", { exact: true })).toBeHidden();
    const google = page.locator(".economy-auth-google button");
    await expect(google).toBeEnabled();
    await google.click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(google).toBeEnabled();
    expect(state.authCalls).toEqual([
      {
        path: "/auth/start",
        body: { provider: "google", returnTo: "/perfil", intent: "login" },
      },
    ]);
    expect(state.googleCalls).toEqual([{ method: "POST", csrf: "csrf" }]);
    await fits(page);
    await page.screenshot({
      path: `/tmp/rods-auth-google-only-${info.project.name}.png`,
      fullPage: true,
    });
    await page.goto(`${googleOnlyURL}/conta?mode=signup&returnTo=%2Fdesafios`);
    await expect(
      page.getByRole("heading", { name: "Guarde cada conquista" }),
    ).toBeVisible();
    await expect(page.getByLabel("E-mail", { exact: true })).toHaveCount(0);
    await expect(
      page.getByLabel("Nome de usuário", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Enviar confirmação", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Criar conta com Google", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Criar conta com Google", exact: true })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(state.authCalls[1]).toEqual({
      path: "/auth/start",
      body: { provider: "google", returnTo: "/desafios", intent: "upgrade" },
    });
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Continuar com Google", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByText("Já tenho uma conta com senha", { exact: true }),
    ).toBeVisible();
    // An old recovery link must land on usable login when email is deferred.
    await page.goto(
      `${googleOnlyURL}/conta?mode=recovery&returnTo=%2Fdesafios`,
    );
    await expect(
      page.getByRole("button", { name: "Continuar com Google", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Enviar link de recuperação" }),
    ).toHaveCount(0);
    await page
      .getByText("Já tenho uma conta com senha", { exact: true })
      .click();
    await page.getByLabel("E-mail", { exact: true }).fill("luna@example.test");
    await page.getByLabel(/^Senha/).fill("secure-password");
    await page
      .locator("form")
      .getByRole("button", { name: "Entrar", exact: true })
      .click();
    await expect(page).toHaveURL(`${googleOnlyURL}/desafios`);
    expect(state.authCalls.map((call) => call.path)).toEqual([
      "/auth/start",
      "/auth/start",
      "/auth/login",
    ]);
  } finally {
    googleOnlyServer.kill();
  }
});
test("successful login opens the account and recovery uses a generic receipt", async ({
  page,
}) => {
  const state = await setup(page, { anonymous: true });
  await page.goto(`${baseURL}/conta`);
  await page
    .getByRole("button", { name: "Recuperar senha", exact: true })
    .click();
  await page.getByLabel("E-mail", { exact: true }).fill("luna@example.test");
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Se este e-mail tiver uma conta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel(/^Senha/).fill("secure-password");
  await page
    .locator("form")
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await expect(page).toHaveURL(`${baseURL}/perfil`);
  expect(state.authCalls.map((c) => c.path)).toEqual([
    "/auth/recover",
    "/auth/login",
  ]);
});

test("Google registration upgrades the guest and keeps the challenge destination", async ({
  page,
}) => {
  const state = await setup(page, { anonymous: true });
  await page.route(
    "https://bsjcuygtpiqyomnulpsw.supabase.co/auth/v1/authorize**",
    (route) => route.fulfill({ contentType: "text/html", body: "Google" }),
  );
  const returnTo = "/desafios/sum-two-integers?language=javascript";
  await page.goto(
    `${baseURL}/conta?mode=signup&returnTo=${encodeURIComponent(returnTo)}`,
  );
  await page
    .getByRole("button", { name: "Criar conta com Google", exact: true })
    .click();
  await expect(page).toHaveURL(/supabase.co\/auth\/v1\/authorize/);
  expect(state.authCalls).toEqual([
    {
      path: "/auth/start",
      body: { provider: "google", returnTo, intent: "upgrade" },
    },
  ]);
});

test("recovery confirmation keeps its destination through verification and password setup", async ({
  page,
}) => {
  const state = await setup(page, { anonymous: true });
  const returnTo = "/desafios/sum-two-integers?language=javascript";
  await page.goto(
    `${baseURL}/conta?mode=recovery&returnTo=${encodeURIComponent(returnTo)}`,
  );
  await page.getByLabel("E-mail", { exact: true }).fill("luna@example.test");
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Se este e-mail tiver uma conta" }),
  ).toBeVisible();
  expect(state.authCalls[0]).toEqual({
    path: "/auth/recover",
    body: { email: "luna@example.test", returnTo },
  });
  await page.goto(
    `${baseURL}/conta/confirmar?token_hash=${"ab".repeat(32)}&type=recovery&returnTo=${encodeURIComponent(returnTo)}`,
  );
  await expect(page).toHaveURL(
    `${baseURL}/conta/confirmar?returnTo=${encodeURIComponent(returnTo)}`,
  );
  await page.getByRole("button", { name: "Confirmar e continuar" }).click();
  await expect(page).toHaveURL(
    `${baseURL}/conta/senha?returnTo=${encodeURIComponent(returnTo)}`,
  );
  await page.getByLabel(/^Nova senha/).fill("secure-password");
  await page.getByLabel("Repita a nova senha").fill("secure-password");
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page).toHaveURL(`${baseURL}${returnTo}`);
});

test("existing accounts can enter with their earlier six-character password", async ({
  page,
}) => {
  const state = await setup(page, { anonymous: true });
  await page.goto(`${baseURL}/conta`);
  await page.getByLabel("E-mail", { exact: true }).fill("luna@example.test");
  await page.getByLabel(/^Senha/).fill("oldpwd");
  await page
    .locator("form")
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await expect(page).toHaveURL(`${baseURL}/perfil`);
  expect(state.authCalls[0]).toEqual({
    path: "/auth/login",
    body: { email: "luna@example.test", password: "oldpwd" },
  });
});
