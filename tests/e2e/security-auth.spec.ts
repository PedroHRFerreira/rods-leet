import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
});

test("callback failure shows a generic accessible message and cleans the marker", async ({
  page,
}) => {
  await page.goto("/perfil?authError=1&from=welcome");
  const alert = page.getByRole("alert");
  await expect(alert).toHaveText(
    "Não foi possível concluir seu login. Tente entrar novamente com a conta associada ao seu convite.",
  );
  await expect(page).toHaveURL(/\/perfil\?from=welcome$/);
  await expect(
    page.getByRole("button", { name: "Continuar com GitHub" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Perfil e progresso" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("callback errors never reflect attacker-controlled URL text", async ({
  page,
}) => {
  const untrusted = "<img src=x onerror=alert(1)>secret-provider-description";
  await page.goto(`/perfil?authError=${encodeURIComponent(untrusted)}`);
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível concluir seu login.",
  );
  await expect(page.getByRole("alert")).not.toContainText(
    "secret-provider-description",
  );
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});
