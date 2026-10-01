import { expect, test } from "@playwright/test";

test("welcome explains the product, remembers dismissal and can be reopened", async ({
  page,
}) => {
  await page.goto("/");
  const guide = page.getByRole("dialog");
  await expect(
    guide.getByRole("heading", { name: "Bem-vindo ao Rods Leet" }),
  ).toBeVisible();
  await expect(guide).toContainText("não exige login");
  await guide.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    guide.getByRole("heading", { name: "Encontre seu caminho" }),
  ).toBeVisible();
  await expect(
    guide.getByRole("heading", { name: "Perfil", exact: true }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(guide).toContainText("A aplicação verifica sua resposta");
  await guide.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(guide).toContainText("15% do XP inicial");
  await expect(guide).toContainText("uma única vez");
  await guide
    .getByRole("button", { name: "Começar pelas perguntas", exact: true })
    .click();
  await expect(page).toHaveURL(/desafios\/concept-values$/);
  await page.reload();
  await expect(guide).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "O que é um valor?", exact: true }),
  ).toBeVisible();
  const menu = page.getByRole("button", { name: "Abrir navegação" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Como funciona" }).click();
  await expect(guide).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guide).toHaveCount(0);
});
