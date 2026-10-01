import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
});

test("legacy callback does not expose credentials or demand login", async ({
  page,
}) => {
  const untrusted = "<img src=x onerror=alert(1)>secret-provider-description";
  await page.goto(
    `/auth/callback?code=secret-code&error_description=${encodeURIComponent(untrusted)}`,
  );
  await expect(
    page.getByRole("heading", { name: "Acesso ao beta" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/callback$/);
  await expect(
    page.getByText(
      "O beta está aberto sem login obrigatório. Continue pelo catálogo de desafios.",
    ),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "secret-provider-description",
  );
  await expect(page.locator("body")).not.toContainText("secret-code");
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await page
    .getByRole("link", { name: "Explorar desafios", exact: true })
    .click();
  await expect(page).toHaveURL(/\/desafios$/);
});

test("profile ignores legacy authentication errors without reflecting URL text", async ({
  page,
}) => {
  await page.goto("/perfil?authError=secret-provider-description");
  await expect(
    page.getByRole("heading", { name: "Perfil e progresso" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "secret-provider-description",
  );
  await expect(page.getByRole("button", { name: /GitHub/ })).toHaveCount(0);
});
