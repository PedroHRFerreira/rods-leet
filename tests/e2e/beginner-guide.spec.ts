import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
});

test("first steps explain one edit at a time and the automatic function call", async ({
  page,
}, info) => {
  for (const id of [
    "literal-number",
    "literal-text",
    "named-value",
    "console-and-return",
    "input-echo",
    "function-double",
  ]) {
    await page.goto(`/desafios/${id}`);
    await expect(page.getByRole("combobox", { name: "Linguagem" })).toHaveValue(
      "javascript",
    );
    const guide = page.getByRole("region", {
      name: "Orientação do modelo da função",
    });
    await expect(guide.getByText("Neste passo", { exact: true })).toBeVisible();
    await expect(guide).toContainText("A aplicação chama essa função por você");
    await expect(guide).toContainText("export function solve(input)");
    await expect(guide).toContainText("Submeter avalia");
    await expect(page.locator(".program-controls")).toContainText(
      "O que fazer:",
    );
    const modelHelp = guide.locator("details").first();
    await expect(modelHelp).not.toHaveAttribute("open", "");
    await modelHelp
      .getByText("Como a função do modelo funciona?", { exact: true })
      .click();
    await expect(modelHelp).toHaveAttribute("open", "");
    await modelHelp
      .getByText("Como a função do modelo funciona?", { exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: `/tmp/rods-beginner-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/desafios/sum-two-integers?language=javascript");
  const guide = page.getByRole("region", {
    name: "Orientação do modelo da função",
  });
  await expect(guide).toContainText("campos a, b");
  await guide.getByText("Posso criar outras funções?", { exact: true }).click();
  await expect(guide).toContainText("Uma função com outro nome");
  await expect(guide.locator("pre").last()).toContainText(
    "return soma(input.a, input.b)",
  );
  await page.screenshot({
    path: `/tmp/rods-sum-guide-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/desafios/find-max?language=python");
  await expect(
    page.getByRole("region", { name: "Orientação do modelo da função" }),
  ).toContainText("def find_max(values");
});

test("the next guided lesson keeps the learner's language", async ({
  page,
}) => {
  await page.goto("/desafios/literal-number?language=python");
  await page
    .getByRole("link", { name: "Seu primeiro texto", exact: true })
    .click();
  await expect(page).toHaveURL(/literal-text\?language=python/);
  await expect(page.getByRole("combobox", { name: "Linguagem" })).toHaveValue(
    "python",
  );
  await expect(
    page.getByRole("region", { name: "Orientação do modelo da função" }),
  ).toContainText("def solve");
});

test("an existing Python draft and a saved language survive the beginner default", async ({
  page,
}) => {
  const draft = "def solve(input):\n    # meu rascunho\n    return 6";
  await page.addInitScript(
    ({ content }) => {
      localStorage.setItem(
        "codegamer:editor:v1:guest:literal-number:python",
        JSON.stringify({
          challengeId: "literal-number",
          languageId: "python",
          files: [{ path: "solution.py", content }],
          updatedAt: new Date().toISOString(),
          localDirty: true,
        }),
      );
    },
    { content: draft },
  );
  await page.goto("/desafios/literal-number");
  await expect(page.getByRole("combobox", { name: "Linguagem" })).toHaveValue(
    "python",
  );
  await page
    .getByRole("button", { name: "Editor simples", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: /Código de/ })).toHaveValue(
    draft,
  );
  await page
    .getByRole("button", { name: "Recarregar modelo da função" })
    .click();
  await page.getByRole("button", { name: "Manter meu código" }).click();
  await expect(page.getByRole("textbox", { name: /Código de/ })).toHaveValue(
    draft,
  );
  await page
    .getByRole("combobox", { name: "Linguagem" })
    .selectOption("javascript");
  await page.goto("/desafios/literal-number");
  await expect(page.getByRole("combobox", { name: "Linguagem" })).toHaveValue(
    "javascript",
  );
});
