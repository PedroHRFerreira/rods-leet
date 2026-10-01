import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("rods-leet-welcome-v1", "seen");
  });
});

test("beta navigation has no tutor or login entry points", async ({ page }) => {
  for (const path of ["/", "/desafios", "/trilhas", "/ranking", "/perfil"]) {
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
    page.getByRole("heading", { name: "Progresso neste navegador" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("Perfil anônimo");
  await expect(page.locator("main")).toContainText(
    "não há recuperação de perfil anônimo entre dispositivos",
  );
});

test("mobile shortcuts keep all four available destinations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const shortcuts = page.getByRole("navigation", {
    name: "Atalhos de navegação",
  });
  await expect(shortcuts).toBeVisible();
  await expect(shortcuts.getByRole("link")).toHaveCount(4);
  await shortcuts.getByRole("link", { name: "Trilhas", exact: true }).click();
  await expect(page).toHaveURL(/\/trilhas$/);
});
