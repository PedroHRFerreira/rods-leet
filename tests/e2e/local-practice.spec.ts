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
async function setup(page: Page) {
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
      };
    else if (path === "/api/challenges") body = challenges;
    else if (path.startsWith("/api/challenges/"))
      body = { ...challenge, executionAvailable: true };
    else if (path === "/api/execution-status") body = { status: "ready" };
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
    "Teste concluído",
    { timeout: 15_000 },
  );
  await expect(page.locator(".local-practice-result")).toContainText(
    "browser-js",
  );
  await expect(page.locator(".local-practice-result")).toContainText(
    "Prática local · sem XP",
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
    "Teste concluído",
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
    "Confira a escrita do código",
  );
  await editor.fill("export function solve(input) { while (true) {} }");
  await run(page);
  await expect(page.locator(".local-practice-result")).toContainText(
    "O teste demorou demais",
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
      "Confira a escrita do código",
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
    page.getByText("Testando no seu dispositivo…", { exact: true }),
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
    page.getByText("Testando no seu dispositivo…", { exact: true }),
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
      "Teste concluído",
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
      "O teste encontrou um erro",
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
