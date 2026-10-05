import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
});

test("dashboard, navigation, theme and not-found page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/Rods Leet/);
  await expect(
    page.getByRole("heading", { name: "Vamos resolver o próximo." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Comece por aqui" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await page
    .getByRole("link", { name: "Responder pergunta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/desafios\/concept-values(?:\?|$)/);
  await expect(
    page.getByRole("heading", {
      name: "O que é um valor?",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/caminho-inexistente");
  await expect(
    page.getByRole("heading", { name: "Este caminho ainda não existe" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("catalog filters all 69 challenges and ten learning tracks", async ({
  page,
}, testInfo) => {
  await page.goto("/desafios");
  await expect(page.locator(".catalog-challenge-card")).toHaveCount(69);
  await page
    .getByRole("group", { name: "Filtrar por trilha" })
    .getByRole("button", { name: /^SQL/ })
    .click();
  await expect(page.locator(".catalog-challenge-card")).toHaveCount(10);
  await page.getByLabel("Dificuldade", { exact: true }).selectOption("hard");
  await expect(page.locator(".catalog-challenge-card")).toHaveCount(3);
  await page
    .getByLabel("Buscar no catálogo")
    .fill("nao existe nenhum desafio assim");
  await expect(
    page.getByRole("heading", { name: "Ainda não encontramos esse desafio" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver todos os desafios" }).click();
  await expect(page.locator(".catalog-challenge-card")).toHaveCount(69);
  await page.goto("/trilhas");
  await expect(
    page.getByRole("heading", { name: "Trilhas de aprendizado" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Do primeiro conceito ao código" }),
  ).toBeVisible();
  await expect(
    page.locator(".constellation-flow .react-flow__node"),
  ).toHaveCount(29);
  await expect(
    page.locator(".constellation-flow .skill-node.cluster-concepts"),
  ).toHaveCount(10);
  await expect(
    page.locator(".constellation-flow .skill-node.cluster-core"),
  ).toHaveCount(6);
  await expect(
    page.locator(".constellation-flow .skill-node.cluster-patterns"),
  ).toHaveCount(7);
  await expect(
    page.locator(".constellation-flow .skill-node.cluster-reasoning"),
  ).toHaveCount(4);
  await expect(
    page.locator(".constellation-flow .skill-node.cluster-mastery"),
  ).toHaveCount(2);
  await expect(page.getByText("Progresso: 0 de 29")).toBeVisible();
  if (testInfo.project.name !== "mobile") {
    await expect(
      page.locator(".constellation-flow .react-flow__edge"),
    ).toHaveCount(2);
    await page.getByRole("button", { name: "Ver mapa completo" }).click();
    await expect(
      page.locator(".constellation-flow .react-flow__edge"),
    ).toHaveCount(28);
  }
  await expect(page.locator(".track-card")).toHaveCount(3);
  await expect(page.locator(".upcoming-track")).toHaveCount(6);
});

test("logic constellation opens node details and uses a guided mobile route", async ({
  page,
}, testInfo) => {
  await page.goto("/trilhas");
  const map = page.getByRole("region", {
    name: /Do primeiro conceito ao código/,
  });
  await expect(map).toBeVisible();
  const node =
    testInfo.project.name === "mobile"
      ? page
          .locator(".constellation-stage-list button")
          .filter({ hasText: "Bônus na variável" })
      : page.getByRole("button", {
          name: /Nó 18: Bônus na variável/,
        });
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(map).toContainText("Bônus na variável");
  await expect(map).toContainText("Etapa anterior sugerida");
  await expect(map).toContainText("Primeira soma");
  const lessonLink = map.getByRole("link", { name: "Abrir desafio" });
  await expect(lessonLink).toBeVisible();
  await expect(lessonLink).toHaveAttribute("href", "/desafios/variable-bonus");
  await lessonLink.click();
  await expect(page).toHaveURL(/variable-bonus(?:\?|$)/);
  await page.goto("/trilhas");
  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".constellation-stage-list")).toBeVisible();
    await expect(page.locator(".constellation-workspace")).toBeHidden();
  } else {
    await expect(page.locator(".constellation-workspace")).toBeVisible();
  }
});

test("logic constellation remains within the tablet viewport", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Pixel coverage uses the linear list",
  );
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/trilhas");
  await expect(page.locator(".constellation-workspace")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("fundamentals challenge adapts its wording and starter code to the selected language", async ({
  page,
}) => {
  await page.goto("/desafios/sum-two-integers?language=python");
  await expect(
    page.getByRole("button", { name: "Submeter solução", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Execute quantas vezes quiser, sem perder XP/),
  ).toBeVisible();
  await expect(page.getByText("Objetivo de aprendizado")).toHaveCount(0);
  await expect(page.locator(".problem-description")).toContainText(
    "A entrada é um dicionário com dois números",
  );
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "def solve(input):",
  );
  await page.getByLabel("Linguagem").selectOption("rust");
  await expect(page.locator(".problem-description")).toContainText(
    "Em Rust, use i32",
  );
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "pub fn solve",
  );
});

test("Monaco loads and drafts survive refresh without grading locally", async ({
  page,
}) => {
  await page.goto("/desafios/find-max?language=typescript");
  await expect(
    page.getByRole("heading", {
      name: "Maior pontuação da equipe",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".monaco-editor").first()).toBeVisible({
    timeout: 30_000,
  });
  await page.locator(".monaco-editor textarea").first().focus();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n// digitado no Monaco");
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("codegamer:editor:v1:guest:find-max:typescript"),
      ),
    )
    .toContain("digitado no Monaco");
  await page
    .getByRole("button", { name: "Editor simples", exact: true })
    .click();
  const code = page.getByRole("textbox", { name: /Código de/ });
  const source =
    "export function findMax(values: readonly number[]): number | null {\n  // meu rascunho persistente\n  return null;\n}\n";
  await code.fill(source);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("codegamer:editor:v1:guest:find-max:typescript"),
      ),
    )
    .toContain("meu rascunho persistente");
  await page.reload();
  await page
    .getByRole("button", { name: "Editor simples", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: /Código de/ })).toHaveValue(
    source,
  );
  const executeButton = page.getByRole("button", {
    name: "Execução indisponível",
    exact: true,
  });
  await expect(executeButton).toBeDisabled();
  await expect(
    page.getByText(
      "A execução remota está indisponível agora. Seu rascunho continua salvo e nenhuma tentativa será consumida.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("Solução aceita", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator(".mode-chip.locked")).toContainText("Fase 2");
  await page.getByRole("tab", { name: "Gabarito", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Gabarito bloqueado" }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Linguagem" })
    .selectOption("python");
  await expect(page).toHaveURL(/language=python/);
  await expect(page.getByRole("tab", { name: "solution.py" })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Linguagem" })
    .selectOption("typescript");
  await expect(page.getByRole("tab", { name: "solution.ts" })).toBeVisible();
  await page
    .getByRole("button", { name: "Editor simples", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: /Código de/ })).toHaveValue(
    source,
  );
});

test("two tabs preserve both drafts until an explicit choice", async ({
  page,
  context,
}) => {
  await page.goto("/desafios/find-max?language=typescript");
  await page
    .getByRole("button", { name: "Editor simples", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /Código de/ })
    .fill("// texto da primeira aba");
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("codegamer:editor:v1:guest:find-max:typescript"),
      ),
    )
    .toContain("texto da primeira aba");
  const second = await context.newPage();
  await second.goto("/desafios/find-max?language=typescript");
  await second
    .getByRole("button", { name: "Editor simples", exact: true })
    .click();
  await expect(second.getByRole("textbox", { name: /Código de/ })).toHaveValue(
    "// texto da primeira aba",
  );
  await second
    .getByRole("textbox", { name: /Código de/ })
    .fill("// texto da segunda aba");
  await expect(
    page.getByRole("button", { name: "Manter esta versão" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Código de/ })).toHaveValue(
    "// texto da primeira aba",
  );
  await page.getByRole("button", { name: "Manter esta versão" }).click();
  await expect(second.getByRole("textbox", { name: /Código de/ })).toHaveValue(
    "// texto da segunda aba",
  );
  await expect(
    second.getByRole("button", { name: "Manter esta versão" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("codegamer:editor:v1:guest:find-max:typescript"),
      ),
    )
    .toContain("texto da primeira aba");
  await second.close();
});

test("SQL uses its own schema and language", async ({ page }) => {
  await page.goto("/desafios/sql-active-orders");
  await expect(
    page.getByRole("heading", { name: "Pedidos confirmados", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Estrutura dos dados" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Linguagem" })).toHaveValue(
    "sql",
  );
  await expect(page.getByRole("tab", { name: "solution.sql" })).toBeVisible();
  await expect(page.locator(".problem-body")).toContainText(
    "CREATE TABLE customers",
  );
});

test("tutor stays hidden and profile is available without login", async ({
  page,
}) => {
  await page.goto("/tutor");
  await expect(page).toHaveURL(/\/desafios$/);
  await expect(page.getByRole("link", { name: /Tutor/ })).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Sua mensagem ao tutor" }),
  ).toHaveCount(0);
  await page.goto("/ranking");
  const hero = page.locator(".ranking-hero");
  await expect(hero).toBeVisible();
  await expect
    .poll(() =>
      hero.evaluate(
        (element) =>
          element.clientWidth > 200 &&
          element.scrollWidth <= element.clientWidth + 1 &&
          element.scrollHeight <= element.clientHeight + 1,
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("heading", {
      name: "Nenhum participante elegível nesta semana",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Geral", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nenhuma pontuação registrada" }),
  ).toBeVisible();
  await expect(page.locator(".ranking-table tbody tr")).toHaveCount(0);
  await page.goto("/perfil");
  await expect(
    page.getByRole("heading", { name: "Perfil e progresso" }),
  ).toBeVisible();
  await expect(
    page.getByText("10 desafios grátis antes do cadastro"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /GitHub/ })).toHaveCount(0);
});

test("keyboard navigation and responsive pages stay within the viewport", async ({
  page,
}, testInfo) => {
  for (const path of [
    "/",
    "/desafios",
    "/trilhas",
    "/ranking",
    "/tutor",
    "/perfil",
    "/desafios/find-max",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      )
      .toBe(true);
  }
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir navegação" }).click();
    await expect(page.locator("#main-navigation")).toHaveClass(/is-open/);
    await page.keyboard.press("Escape");
    await expect(page.locator("#main-navigation")).not.toHaveClass(/is-open/);
    await expect(
      page.getByRole("button", { name: "Abrir navegação" }),
    ).toBeFocused();
  }
});
