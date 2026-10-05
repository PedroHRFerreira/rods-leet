import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { challenges } from "../../src/content/catalog";
import { guestDashboard } from "../../src/lib/gateway";

let server: ChildProcess;
let baseURL: string;
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ playwright }, info) => {
  void playwright;
  const port = info.project.name === "mobile" ? 5193 : 5192;
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
    .poll(async () => {
      try {
        return (await fetch(baseURL)).status;
      } catch {
        return 0;
      }
    })
    .toBe(200);
});
test.afterAll(() => server?.kill());

async function setup(
  page: import("@playwright/test").Page,
  dropFirstResponse = false,
) {
  const completed = new Set<string>();
  const rejected = new Map<string, number>();
  const evaluations = new Map<string, object>();
  const answers: Array<{ key: string; optionId: string }> = [];
  const paths: string[] = [];
  let xp = 0;
  let dropped = false;
  let identity = "quiz-learner";
  const correct: Record<string, string> = {
    "concept-values": "b",
    "concept-variables": "a",
    "concept-numbers": "c",
    "concept-text": "b",
    "concept-booleans": "a",
    "concept-functions": "c",
    "concept-parameters": "b",
    "concept-return": "a",
    "concept-export": "c",
    "concept-classes": "b",
  };
  const attempt = (id: string) => ({
    id: `attempt-${id}`,
    challengeId: id,
    challengeVersionId: `${id}:v1`,
    mode: "normal",
    status: completed.has(id) ? "accepted" : "active",
    rejectedCount: rejected.get(id) ?? 0,
    hintsUsed: 0,
    practiceOnly: false,
    pendingCount: 0,
    startedAt: new Date().toISOString(),
    deadlineAt: null,
    solutionAvailable: false,
  });
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    paths.push(`${request.method()} ${path}`);
    let body: unknown;
    if (path === "/api/session")
      body = { user: { id: identity }, csrf: "test" };
    else if (path === "/api/dashboard")
      body = {
        ...guestDashboard(),
        profile: {
          id: identity,
          anonymous: true,
          authenticated: true,
          displayName: "Visitante",
        },
        xp,
        completedCount: completed.size,
        completedChallengeIds: [...completed],
        remoteRunsRemaining: null,
      };
    else if (path === "/api/challenges") body = challenges;
    else if (path.startsWith("/api/challenges/"))
      body = {
        ...challenges.find((c) => c.id === path.split("/").at(-1)),
        executionAvailable: true,
      };
    else if (path === "/api/attempts")
      body = attempt(request.postDataJSON().challengeVersionId.split(":")[0]);
    else if (path.startsWith("/api/attempts/"))
      body = attempt(path.split("/").at(-1)!.replace("attempt-", ""));
    else if (path === "/api/quiz-submissions") {
      const input = request.postDataJSON();
      const id = input.challengeVersionId.split(":")[0];
      const key = request.headers()["idempotency-key"];
      answers.push({ key, optionId: input.optionId });
      if (!evaluations.has(key)) {
        const accepted = correct[id] === input.optionId;
        const reward = accepted
          ? Math.max(0, Math.floor(20 * (1 - 0.15 * (rejected.get(id) ?? 0))))
          : 0;
        if (accepted) {
          completed.add(id);
          xp += reward;
        } else rejected.set(id, (rejected.get(id) ?? 0) + 1);
        evaluations.set(key, {
          id: `result-${key}`,
          attemptId: `attempt-${id}`,
          submittedAt: new Date().toISOString(),
          status: "completed",
          verdict: accepted ? "accepted" : "wrong_answer",
          xpAwarded: reward,
          message: accepted
            ? "Isso mesmo! Você entendeu o conceito."
            : "Ainda não. Um número é um valor numérico, escrito sem aspas.",
        });
      }
      if (dropFirstResponse && !dropped) {
        dropped = true;
        await route.abort();
        return;
      }
      body = evaluations.get(key);
    } else if (path.startsWith("/api/drafts")) body = null;
    else if (path === "/api/execution-status") body = { status: "ready" };
    else if (path === "/api/ranking") body = [];
    else {
      await route.fulfill({
        status: 404,
        json: { error: { code: "unexpected_route" } },
      });
      return;
    }
    await route.fulfill({ json: body });
  });
  return {
    correct,
    completed,
    answers,
    paths,
    setIdentity: (value: string) => {
      identity = value;
    },
  };
}

async function confirm(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: "Confirmar resposta", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar envio", exact: true })
    .click();
}

test("concepts lead through ten questions and explain account access before code", async ({
  page,
}, info) => {
  const state = await setup(page);
  await page.goto(`${baseURL}/desafios/concept-values?language=python`);
  const quizzes = challenges.filter((c) => c.kind === "quiz");
  for (const [index, quiz] of quizzes.entries()) {
    await expect(
      page.getByRole("heading", { name: quiz.title, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(3);
    await expect(page.getByRole("combobox", { name: "Linguagem" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("region", { name: "Editor da solução" }),
    ).toHaveCount(0);
    if (index === 0) {
      await page.getByRole("radio").nth(0).check();
      await page
        .getByRole("button", { name: "Confirmar resposta", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Revisar resposta" }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
      expect(state.answers).toHaveLength(0);
      await confirm(page);
      await expect(
        page.getByRole("heading", { name: "Ainda não foi desta vez" }),
      ).toBeVisible();
      await page.screenshot({
        path: `/tmp/rods-concept-wrong-${info.project.name}.png`,
        fullPage: true,
      });
      await expect(page.locator(".concept-quiz-reward")).toContainText("17 XP");
      await page.getByRole("button", { name: "Tentar outra resposta" }).click();
    }
    const option = quiz.quiz!.options.find(
      (o) => o.id === state.correct[quiz.id],
    )!;
    await page.getByRole("radio", { name: option.text, exact: true }).check();
    await confirm(page);
    await expect(
      page.getByRole("heading", { name: "Resposta certa!" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (index === 0) {
      await expect(page.locator(".earned-xp")).toContainText("17 XP");
      await page.screenshot({
        path: `/tmp/rods-concept-success-${info.project.name}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Ativar tema claro", exact: true })
        .click();
      await expect(
        page.locator(".result-reaction--success[data-play='true']"),
      ).toHaveCount(1);
      await page.screenshot({
        path: `/tmp/rods-concept-success-light-${info.project.name}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Ativar tema escuro", exact: true })
        .click();
      await page.reload();
      await expect(
        page.getByRole("region", { name: "Etapa concluída" }),
      ).toContainText("Você já concluiu");
    }
    await page
      .getByRole("link", { name: "Próximo passo", exact: true })
      .click();
  }
  await expect(page).toHaveURL(/literal-number\?language=python/);
  await expect(page.getByRole("combobox", { name: "Linguagem" })).toHaveCount(
    0,
  );
  expect(state.completed.size).toBe(10);
  await expect(page.locator(".visitor-progress-card")).toContainText(
    "10 desafios concluídos",
  );
  expect(
    state.paths.filter((p) => p.includes("quiz-submissions")),
  ).toHaveLength(11);
});

test("a lost response retries the same answer without allowing a second choice", async ({
  page,
}, info) => {
  const state = await setup(page, true);
  await page.goto(`${baseURL}/desafios/concept-values`);
  await page.getByRole("radio").nth(0).check();
  await confirm(page);
  await expect(page.getByRole("alert")).toContainText(
    "Vamos confirmar seu envio",
  );
  await expect(page.locator(".result-reaction")).toHaveCount(0);
  await expect(page.getByRole("radio").nth(1)).toBeDisabled();
  await page.screenshot({
    path: `/tmp/rods-concept-network-error-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ainda não foi desta vez" }),
  ).toBeVisible();
  await expect(page.locator(".concept-quiz-reward")).toContainText("17 XP");
  expect(state.answers).toHaveLength(2);
  expect(state.answers[0]).toEqual(state.answers[1]);
});

const skipLabel = "Não pedir confirmação novamente neste navegador";

test("a visitor with ten completed challenges gets an explicit login gate before a new question", async ({
  page,
}) => {
  const state = await setup(page);
  for (let index = 0; index < 10; index++)
    state.completed.add(`solved-${index}`);
  await page.goto(`${baseURL}/desafios/concept-values`);
  await expect(page.locator(".visitor-progress-card")).toContainText(
    "10 desafios concluídos",
  );
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Criar conta e guardar progresso" }),
  ).toHaveAttribute(
    "href",
    /mode=signup&returnTo=%2Fdesafios%2Fconcept-values/,
  );
  expect(state.paths.some((path) => path === "POST /api/attempts")).toBe(false);
  expect(state.answers).toHaveLength(0);
});

test("a server limit reached in another tab replaces retry feedback with account access", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/quiz-submissions", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: {
          code: "visitor_challenge_limit",
          message: "Entre para continuar.",
        },
      },
    }),
  );
  await page.goto(`${baseURL}/desafios/concept-values`);
  await page.getByRole("radio").nth(1).check();
  await confirm(page);
  await expect(
    page.locator(".visitor-progress-card[role='alert']"),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Já tenho uma conta", exact: true }),
  ).toBeVisible();
});

test("confirmation preference is saved only on send, persists, and can be re-enabled from profile", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(`${baseURL}/desafios/concept-values`);
  await page.getByRole("radio").nth(0).check();
  await page
    .getByRole("button", { name: "Confirmar resposta", exact: true })
    .click();
  await page.getByRole("checkbox", { name: skipLabel, exact: true }).check();
  await page
    .getByRole("button", { name: "Revisar resposta", exact: true })
    .click();
  expect(state.answers).toHaveLength(0);
  await page
    .getByRole("button", { name: "Confirmar resposta", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: skipLabel, exact: true }),
  ).not.toBeChecked();
  await page.getByRole("checkbox", { name: skipLabel, exact: true }).check();
  await page
    .getByRole("button", { name: "Confirmar envio", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ainda não foi desta vez" }),
  ).toBeVisible();
  await expect(
    page.locator(".result-reaction--encouragement[data-play='true']"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Tentar outra resposta" }).click();
  await page.getByRole("radio").nth(1).check();
  await page
    .getByRole("button", { name: "Confirmar resposta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resposta certa!" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.answers).toHaveLength(2);
  await page.getByRole("link", { name: "Próximo passo", exact: true }).click();
  await page.reload();
  await page.getByRole("radio").nth(0).check();
  await page
    .getByRole("button", { name: "Confirmar resposta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resposta certa!" }),
  ).toBeVisible();
  expect(state.answers).toHaveLength(3);
  await page.goto(`${baseURL}/perfil`);
  const quizPreference = page.getByRole("checkbox", {
    name: "Pedir confirmação nas perguntas",
    exact: true,
  });
  const codePreference = page.getByRole("checkbox", {
    name: "Pedir confirmação no código",
    exact: true,
  });
  await expect(quizPreference).not.toBeChecked();
  await expect(codePreference).toBeChecked();
  await quizPreference.check();
  await page.goto(`${baseURL}/desafios/concept-numbers`);
  await page.getByRole("radio").nth(2).check();
  await page
    .getByRole("button", { name: "Confirmar resposta", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.answers).toHaveLength(3);
});

test("browser preferences stay separate for quiz, code and learner identity", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(`${baseURL}/perfil`);
  const quizPreference = page.getByRole("checkbox", {
    name: "Pedir confirmação nas perguntas",
    exact: true,
  });
  const codePreference = page.getByRole("checkbox", {
    name: "Pedir confirmação no código",
    exact: true,
  });
  await quizPreference.uncheck();
  await expect(codePreference).toBeChecked();
  await page.reload();
  await expect(quizPreference).not.toBeChecked();
  await expect(codePreference).toBeChecked();
  state.setIdentity("another-learner");
  await page.reload();
  await expect(quizPreference).toBeChecked();
  await expect(codePreference).toBeChecked();
  await codePreference.uncheck();
  await expect(quizPreference).toBeChecked();
  state.setIdentity("quiz-learner");
  await page.reload();
  await expect(quizPreference).not.toBeChecked();
  await expect(codePreference).toBeChecked();
});

test("confirmed progress updates once and reduced motion suppresses the visual animation", async ({
  page,
}, info) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${baseURL}/desafios/concept-values`);
  const progress = page.getByRole("progressbar", {
    name: /Módulo de conceitos/,
  });
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await expect(progress).toHaveAttribute("aria-valuemax", "10");
  await page.getByRole("radio").nth(1).check();
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Resposta certa!" }),
  ).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await expect(page.locator(".learning-progress")).toContainText(
    "Faltam 9 etapas",
  );
  const reaction = page.locator(".result-reaction--success[data-play='true']");
  await expect(reaction).toHaveCount(1);
  await expect(reaction).toHaveAttribute("aria-hidden", "true");
  expect(
    await reaction
      .locator("svg")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await page.screenshot({
    path: `/tmp/rods-quiz-reduced-motion-${info.project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Etapa concluída" }),
  ).toBeVisible();
  await expect(page.locator(".result-reaction[data-play='true']")).toHaveCount(
    0,
  );
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
});
