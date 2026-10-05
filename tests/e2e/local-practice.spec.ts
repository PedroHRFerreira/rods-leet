import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { challenges } from "../../src/content/catalog";
import { guestDashboard } from "../../src/lib/gateway";

let server: ChildProcess;
let baseURL: string;
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ playwright }, info) => {
  void playwright;
  const port = info.project.name === "mobile" ? 5199 : 5198;
  baseURL = `http://127.0.0.1:${port}`;
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
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
        VITE_LOCAL_PRACTICE_ENABLED: "true",
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
const challenge = challenges.find((item) => item.id === "sum-two-integers")!;
async function setup(
  page: Page,
  executionStatus: "ready" | "offline" | (() => "ready" | "offline") = "ready",
  completedChallengeIds: string[] = [],
) {
  const remote: Array<{ path: string; body: unknown }> = [];
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown;
    if (path === "/api/session")
      body = { user: { id: "local-visitor" }, csrf: "local-csrf" };
    else if (path === "/api/dashboard")
      body = {
        ...guestDashboard(),
        profile: {
          id: "local-visitor",
          displayName: "Visitante",
          authenticated: true,
          anonymous: true,
        },
        remoteRunsRemaining: null,
        completedChallengeIds,
        completedCount: completedChallengeIds.length,
      };
    else if (path === "/api/challenges") body = challenges;
    else if (path.startsWith("/api/challenges/"))
      body = { ...challenge, executionAvailable: true };
    else if (path === "/api/execution-status")
      body = {
        status:
          typeof executionStatus === "function"
            ? executionStatus()
            : executionStatus,
      };
    else if (path.startsWith("/api/attempts"))
      body = {
        id: "local-attempt",
        challengeId: challenge.id,
        challengeVersionId: challenge.versionId,
        mode: "normal",
        status: "active",
        startedAt: new Date().toISOString(),
        hintsUsed: 0,
        rejectedCount: 0,
        practiceOnly: false,
      };
    else if (path === "/api/drafts" && route.request().method() === "PUT")
      body = { saved: true, revision: 1, updatedAt: new Date().toISOString() };
    else if (path.startsWith("/api/drafts")) body = null;
    else if (path === "/api/runs" || path === "/api/submissions") {
      remote.push({ path, body: route.request().postDataJSON() });
      body = {
        id: "remote-local-run",
        attemptId: "local-attempt",
        status: "completed",
        verdict: "accepted",
        submittedAt: new Date().toISOString(),
        stdout: "server-python-output",
      };
    } else body = [];
    await route.fulfill({ json: body });
  });
  return remote;
}
async function openEditor(page: Page, language = "javascript") {
  await page.goto(`${baseURL}/desafios/sum-two-integers?language=${language}`);
  await page
    .getByRole("button", { name: "Editor simples", exact: true })
    .click();
  return page.getByRole("textbox", { name: /Código de/ });
}
async function run(page: Page) {
  await page
    .getByRole("button", { name: "Executar código", exact: true })
    .click();
}

test("offline executor allows retries without consuming attempts and preserves other languages", async ({
  page,
}, info) => {
  const remote = await setup(page, "offline");
  const editor = await openEditor(page);
  await expect(
    page.getByText("Vamos conferir o avaliador ao enviar.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submeter solução", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Submeter solução", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar submissão", exact: true })
    .click();
  await expect(page.locator(".arena-alert[role=alert]")).toContainText(
    "nenhuma tentativa foi consumida",
  );
  expect(remote).toHaveLength(0);
  await editor.fill(
    "export function solve(input) { return input.a + input.b; }",
  );
  await run(page);
  await expect(page.locator(".local-practice-result")).toBeVisible();
  expect(remote).toHaveLength(0);
  for (const width of [320, 390, 800, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByText("Vamos conferir o avaliador ao enviar.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submeter solução", exact: true }),
    ).toBeEnabled();
    if (process.env.RODS_VISUAL_CAPTURE === "true") {
      await page.locator(".code-actions").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `/tmp/rods-executor-offline-${info.project.name}-${width}.png`,
      });
    }
  }
  await page
    .getByRole("button", { name: "Ativar tema claro", exact: true })
    .click();
  await expect(
    page.getByText("Vamos conferir o avaliador ao enviar.", { exact: true }),
  ).toBeVisible();
  if (process.env.RODS_VISUAL_CAPTURE === "true") {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator(".code-actions").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `/tmp/rods-executor-offline-light-${info.project.name}-${width}.png`,
      });
    }
  }
  const languages = page.getByLabel("Linguagem", { exact: true });
  for (const language of challenge.languageIds) {
    await languages.selectOption(language);
    await expect(
      page.getByRole("button", { name: "Submeter solução", exact: true }),
    ).toBeEnabled();
    if (language !== "javascript" && language !== "typescript")
      await expect(
        page.getByRole("button", {
          name: "Execução indisponível",
          exact: true,
        }),
      ).toBeDisabled();
  }
});

test("submit refreshes stale offline health and sends after recovery", async ({
  page,
}) => {
  let ready = false;
  const remote = await setup(page, () => (ready ? "ready" : "offline"));
  await openEditor(page);
  await expect(
    page.getByText("Vamos conferir o avaliador ao enviar.", { exact: true }),
  ).toBeVisible();
  ready = true;
  await page
    .getByRole("button", { name: "Submeter solução", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar submissão", exact: true })
    .click();
  await expect.poll(() => remote.length).toBe(1);
  expect(remote[0].path).toBe("/api/submissions");
});

test("ten distinct completed challenges require account before a new challenge", async ({
  page,
}) => {
  const completed = challenges
    .filter((item) => item.id !== challenge.id)
    .slice(0, 10)
    .map((item) => item.id);
  const remote = await setup(page, "ready", completed);
  await page.goto(`${baseURL}/desafios/${challenge.id}?language=javascript`);
  await expect(
    page.getByRole("heading", {
      name: "10 desafios concluídos. Seu próximo passo é criar uma conta.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submeter solução", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Criar conta e guardar progresso" }),
  ).toHaveAttribute(
    "href",
    /mode=signup&returnTo=%2Fdesafios%2Fsum-two-integers%3Flanguage%3Djavascript/,
  );
  expect(remote).toHaveLength(0);
});

test("completed challenges remain open and duplicate progress does not trigger the limit", async ({
  page,
}) => {
  await setup(page, "ready", Array(10).fill(challenge.id));
  await openEditor(page);
  await expect(
    page.getByRole("button", { name: "Desafio aprovado", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Executar código", exact: true }),
  ).toBeEnabled();
});

test("JS and TS run in real isolated workers without server runs, XP or completion", async ({
  page,
}) => {
  const remote = await setup(page);
  const editor = await openEditor(page);
  await editor.fill(
    'export function solve(input) { console.log("browser-js"); return input.a + input.b; }',
  );
  await run(page);
  await expect(page.locator(".local-practice-result")).toContainText(
    "Retorno da função",
    { timeout: 15_000 },
  );
  await expect(page.locator(".local-practice-result")).toContainText(
    "browser-js",
  );
  await expect(page.locator(".local-practice-result")).toContainText(
    "Retorno da função",
  );
  await expect(page.locator(".local-practice-result")).not.toContainText(
    /aprov|Passou|Não passou|correto|XP/,
  );
  await editor.fill("export function solve(input) { return 999; }");
  await run(page);
  await expect(page.locator(".local-practice-result pre")).toHaveText("999");
  await expect(page.locator(".local-practice-result")).not.toContainText(
    /aprov|Passou|Não passou|correto|XP/,
  );
  await expect(page.locator(".arena-xp strong")).toHaveText(
    `${challenge.baseXp} XP`,
  );
  await expect(page.locator(".learning-progress-heading")).toContainText(
    "0 de",
  );
  await page
    .getByLabel("Linguagem", { exact: true })
    .selectOption("typescript");
  await page
    .getByRole("button", { name: "Editor simples", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /Código de/ })
    .fill(
      'export function solve(input: { a: number; b: number }): number { console.log("browser-ts"); return input.a + input.b; }',
    );
  await run(page);
  await expect(page.locator(".local-practice-result")).toContainText(
    "Retorno da função",
    { timeout: 15_000 },
  );
  await expect(page.locator(".local-practice-result")).toContainText(
    "browser-ts",
  );
  expect(remote).toHaveLength(0);
  await expect(page.locator(".arena-xp strong")).toHaveText(
    `${challenge.baseXp} XP`,
  );
});

test("syntax errors and infinite loops remain learner results without remote fallback", async ({
  page,
}) => {
  const remote = await setup(page);
  const editor = await openEditor(page);
  await editor.fill("export function solve( {");
  await run(page);
  await expect(page.locator(".local-practice-result")).toContainText(
    "Erro de sintaxe ou tipo",
  );
  await editor.fill("export function solve(input) { while (true) {} }");
  await run(page);
  await expect(page.locator(".local-practice-result")).toContainText(
    "Tempo de execução excedido",
    { timeout: 15_000 },
  );
  expect(remote).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Executar código", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Linguagem", { exact: true })
    .selectOption("typescript");
  await page
    .getByRole("button", { name: "Editor simples", exact: true })
    .click();
  const typedEditor = page.getByRole("textbox", { name: /Código de/ });
  for (const source of [
    'export function solve(input: number): number { return "wrong"; }',
    `export function solve(){return ${"a".repeat(20000)}}`,
  ]) {
    await typedEditor.fill(source);
    await run(page);
    await expect(page.locator(".local-practice-result")).toContainText(
      "Erro de sintaxe ou tipo",
      { timeout: 15000 },
    );
  }
  expect(remote).toHaveLength(0);
});

test("changing language aborts pending local work and ignores stale replies", async ({
  page,
}) => {
  const remote = await setup(page);
  const editor = await openEditor(page);
  await editor.fill("export function solve(input) { while (true) {} }");
  await run(page);
  await expect(
    page
      .locator(".local-practice-result")
      .getByText("Executando…", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Linguagem", { exact: true }).selectOption("python");
  await expect(page.locator(".local-practice-result")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Executar código", exact: true }),
  ).toBeEnabled();
  await page.waitForTimeout(3_400);
  await expect(page.locator(".local-practice-result")).toHaveCount(0);
  expect(remote).toHaveLength(0);
});

test("leaving the page cancels pending local work", async ({ page }) => {
  const remote = await setup(page);
  const editor = await openEditor(page);
  await editor.fill("export function solve(input) { while (true) {} }");
  await run(page);
  await expect(
    page
      .locator(".local-practice-result")
      .getByText("Executando…", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Desafios", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/desafios$/);
  await page.waitForTimeout(3_400);
  await expect(page.locator(".local-practice-result")).toHaveCount(0);
  expect(remote).toHaveLength(0);
});

test("Python keeps the existing server practice flow", async ({ page }) => {
  const remote = await setup(page);
  const editor = await openEditor(page, "python");
  await editor.fill('def solve(input):\n    return input["a"] + input["b"]');
  await run(page);
  await expect(page.locator(".results-panel")).toContainText(
    "server-python-output",
  );
  expect(remote).toHaveLength(1);
  expect(remote[0]).toMatchObject({
    path: "/api/runs",
    body: { languageId: "python", executionMode: "function" },
  });
  await expect(page.locator(".local-practice-result")).toHaveCount(0);
  await expect(page.locator(".arena-xp strong")).toHaveText(
    `${challenge.baseXp} XP`,
  );
});

test("local success and errors remain readable at responsive boundaries in both themes", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const remote = await setup(page);
  const editor = await openEditor(page);
  for (const width of [320, 390, 800, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await editor.fill(
      'export function solve(input) { console.log("example"); return input.a + input.b; }',
    );
    await run(page);
    await expect(page.locator(".local-practice-result")).toContainText(
      "Retorno da função",
    );
    for (const theme of ["dark", "light"]) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/rods-local-success-${width}-${theme}-${info.project.name}.png`,
        fullPage: true,
      });
    }
    await editor.fill(
      'export function solve(input) { throw new Error("adjust the example"); }',
    );
    await run(page);
    await expect(page.locator(".local-practice-result")).toContainText(
      "Erro de execução",
    );
    for (const theme of ["dark", "light"]) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/rods-local-error-${width}-${theme}-${info.project.name}.png`,
        fullPage: true,
      });
    }
  }
  expect(remote).toHaveLength(0);
});
