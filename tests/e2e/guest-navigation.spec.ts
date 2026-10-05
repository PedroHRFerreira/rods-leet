import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("rods-leet-welcome-v1", "seen");
  });
});

test("exploration remains free and explains registered account access without a tutor or social login", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/desafios",
    "/trilhas",
    "/ranking",
    "/loja",
    "/perfil",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator('a[href="/tutor"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /GitHub|Sair da conta/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Entrar com GitHub|Acessar beta/ }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("link", { name: "Criar conta e guardar progresso" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("Perfil de visitante");
  await expect(page.locator("main")).toContainText(
    "Libere a loja, itens equipáveis e recompensas das metas de estudo",
  );
});

test("mobile shortcuts keep all six available destinations accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const shortcuts = page.getByRole("navigation", {
    name: "Atalhos de navegação",
  });
  await expect(shortcuts).toBeVisible();
  await expect(shortcuts.getByRole("link")).toHaveCount(6);
  await shortcuts.getByRole("link", { name: "Trilhas", exact: true }).click();
  await expect(page).toHaveURL(/\/trilhas$/);
  await shortcuts.getByRole("link", { name: "Loja", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Loja e inventário" }),
  ).toBeVisible();
  await shortcuts.getByRole("link", { name: "Feedback", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Envie seu feedback" }),
  ).toBeVisible();
  await expect(
    page.getByText("O envio de feedback precisa de uma sessão conectada.", {
      exact: false,
    }),
  ).toBeVisible();
});
