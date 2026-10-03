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
    { env: { ...process.env, VITE_BFF_ENABLED: "true" }, stdio: "inherit" },
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
  } = {},
) {
  const shop = guestShop();
  shop.coins = 500;
  let anonymous = options.anonymous ?? false;
  let userId = anonymous ? "visitor" : "learner";
  let hints = 1;
  const purchases: Array<{ key: string; body: Record<string, unknown> }> = [];
  const authCalls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const applied = new Set<string>();
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session")
      return route.fulfill({ json: { user: { id: userId }, csrf: "csrf" } });
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
      if (!applied.has(key)) {
        applied.add(key);
        shop.coins -= Number(body.expectedPrice);
        if (body.itemId === "hint-extra") hints++;
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
  return { shop, purchases, authCalls };
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
  await page.screenshot({
    path: `/tmp/rods-shop-error-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Tentar esta operação novamente" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "adicionado ao inventário" }),
  ).toBeVisible();
  expect(state.purchases).toHaveLength(2);
  expect(state.purchases[0]).toEqual(state.purchases[1]);
  expect(state.shop.coins).toBe(400);
  await card.getByRole("button", { name: "Equipar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar e equipar" }).click();
  await expect(
    card.getByRole("button", { name: "Equipado", exact: true }),
  ).toBeDisabled();
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
    page.getByRole("link", { name: "Entrar ou criar conta", exact: true }),
  ).toBeVisible();
  for (const button of await page
    .getByRole("button", { name: "Disponível com sua conta" })
    .all())
    await expect(button).toBeDisabled();
  expect(state.purchases).toHaveLength(0);
  await fits(page);
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
      body: { email: "luna@example.test", displayName: "Luna" },
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
  await expect(page).toHaveURL(`${baseURL}/conta/confirmar`);
  // Wait on authenticated dashboard rendering so initial identity remount has completed.
  await expect(page.locator(".topbar-coins")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar e continuar" }).click();
  await expect(page).toHaveURL(`${baseURL}/conta/senha`);
  await page.getByLabel(/^Nova senha/).fill("secure-password");
  await page.getByLabel("Repita a nova senha").fill("secure-password");
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page).toHaveURL(`${baseURL}/perfil`);
  expect(state.authCalls.map((c) => c.path)).toEqual([
    "/auth/confirm",
    "/auth/password",
  ]);
});
test("invalid login shows an error without navigating or offering social login", async ({
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
  await expect(page.getByRole("button", { name: /Google|GitHub/ })).toHaveCount(
    0,
  );
  await fits(page);
  await page.screenshot({
    path: `/tmp/rods-auth-error-${info.project.name}.png`,
    fullPage: true,
  });
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
