import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { challenges } from "../../src/content/catalog";
import { guestDashboard } from "../../src/lib/gateway";
import type {
  PublicSubmission,
  SubmissionInput,
} from "../../src/lib/contracts";

// Dedicated connected frontend; APIs are simulated here, execution is verified
// separately by the isolated executor's real multi-language homologation.
let server: ChildProcess;
let baseURL: string;
test.beforeAll(async ({ playwright }, info) => {
  void playwright;
  const port = info.project.name === "mobile" ? 5183 : 5182;
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
    {
      env: { ...process.env, VITE_BFF_ENABLED: "true" },
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

test("free output, submission confirmation, retries, reward and next step", async ({
  page,
}, testInfo) => {
  const challenge = challenges.find((item) => item.id === "sum-two-integers")!;
  let rejections = 0;
  let accepted = false;
  const requests: SubmissionInput[] = [];
  const evaluations = new Map<string, PublicSubmission>();
  const attempt = () => ({
    id: "attempt-free",
    userId: "beta-visitor",
    challengeVersionId: challenge.versionId,
    mode: "normal",
    status: accepted ? "accepted" : "active",
    hintsUsed: 0,
    rejectedCount: rejections,
    practiceOnly: false,
    startedAt: new Date().toISOString(),
  });
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let body: unknown;
    if (path === "/api/session")
      body = { user: { id: "beta-visitor" }, csrf: "test-csrf" };
    else if (path === "/api/dashboard")
      body = {
        ...guestDashboard(),
        profile: {
          id: "beta-visitor",
          displayName: "Visitante",
          authenticated: true,
          anonymous: true,
        },
        remoteRunsRemaining: null,
        completedChallengeIds: accepted ? [challenge.id] : [],
      };
    else if (path.startsWith("/api/challenges/"))
      body = { ...challenge, executionAvailable: true };
    else if (path === "/api/execution-status") body = { status: "ready" };
    else if (path.startsWith("/api/attempts")) body = attempt();
    else if (path === "/api/drafts" && method === "PUT")
      body = { saved: true, revision: 1, updatedAt: new Date().toISOString() };
    else if (path.startsWith("/api/drafts")) body = null;
    else if (
      (path === "/api/runs" || path === "/api/submissions") &&
      method === "POST"
    ) {
      const input = route.request().postDataJSON() as SubmissionInput;
      requests.push(input);
      const run = path.endsWith("runs");
      if (!run) {
        if (rejections === 0) rejections++;
        else accepted = true;
      }
      const result: PublicSubmission = {
        id: `evaluation-${requests.length}`,
        attemptId: "attempt-free",
        status: "completed",
        verdict: run || accepted ? "accepted" : "wrong_answer",
        xpAwarded: accepted && !run ? Math.floor(challenge.baseXp * 0.85) : 0,
        stdout: run ? "5\n" : undefined,
        stderr: run ? "Aviso de teste\n" : undefined,
      };
      evaluations.set(result.id, result);
      body = result;
    } else if (path.startsWith("/api/submissions/"))
      body = evaluations.get(path.split("/").at(-1)!);
    else body = [];
    await route.fulfill({ json: body });
  });
  await page.goto(`${baseURL}/desafios/sum-two-integers?language=python`);
  await expect(page.getByLabel("Forma de executar")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Editor simples", exact: true })
    .click();
  const editor = page.getByRole("textbox", { name: /Código de/ });
  await editor.fill(
    'def solve(entrada):\n    print(entrada)\n    return entrada["a"] + entrada["b"]',
  );
  await expect(editor).toHaveValue(
    'def solve(entrada):\n    print(entrada)\n    return entrada["a"] + entrada["b"]',
  );
  await page
    .getByRole("button", { name: "Recarregar modelo da função" })
    .click();
  await page.getByRole("button", { name: "Manter meu código" }).click();
  await expect(editor).toHaveValue(
    'def solve(entrada):\n    print(entrada)\n    return entrada["a"] + entrada["b"]',
  );
  await page
    .getByRole("button", { name: "Executar código", exact: true })
    .click();
  await expect(page.getByText("Saída do seu código")).toBeVisible();
  await expect(page.locator(".program-output").first()).toContainText("5");
  await expect(page.getByText("Erros e avisos")).toBeVisible();
  await page
    .locator(".arena-work-column")
    .screenshot({ path: `/tmp/rods-free-editor-${testInfo.project.name}.png` });
  await page
    .getByRole("button", { name: "Executar código", exact: true })
    .click();
  await expect.poll(() => requests.length).toBe(2);
  await page
    .getByRole("button", { name: "Submeter solução", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Submeter esta solução?",
  );
  expect(requests).toHaveLength(2);
  await page.getByRole("button", { name: "Continuar editando" }).click();
  await expect(editor).toHaveValue(
    'def solve(entrada):\n    print(entrada)\n    return entrada["a"] + entrada["b"]',
  );
  await page
    .getByRole("button", { name: "Submeter solução", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar submissão" }).click();
  await expect(
    page.getByText("Resposta incorreta", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".arena-xp strong")).toHaveText(
    `${Math.floor(challenge.baseXp * 0.85)} XP`,
  );
  await page
    .locator(".results-panel")
    .screenshot({ path: `/tmp/rods-free-error-${testInfo.project.name}.png` });
  await expect(
    page.getByRole("button", { name: "Submeter solução", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Submeter solução", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar submissão" }).click();
  await expect(page.getByRole("dialog")).toContainText("Desafio aprovado!");
  await page.getByRole("dialog").screenshot({
    path: `/tmp/rods-free-approved-${testInfo.project.name}.png`,
  });
  await expect(page.getByRole("dialog")).toContainText(
    `${Math.floor(challenge.baseXp * 0.85)} XP`,
  );
  await expect(
    page.getByRole("link", { name: "Próximo desafio", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver meu resultado" }).click();
  await expect(
    page.getByRole("button", { name: "Desafio aprovado", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Executar código", exact: true }),
  ).toBeEnabled();
  expect(requests.every((input) => input.executionMode === "function")).toBe(
    true,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
