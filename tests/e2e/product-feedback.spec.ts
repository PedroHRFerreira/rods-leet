import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { guestDashboard } from "../../src/lib/gateway";
import { challenges } from "../../src/content/catalog";

let server: ChildProcess;
let baseURL: string;
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ playwright }, info) => {
  void playwright;
  const port = info.project.name === "mobile" ? 5195 : 5194;
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

const receipt = {
  protocol: "00000000-0000-4000-8000-000000000001",
  createdAt: "2026-10-01T12:00:00Z",
};
async function setup(page: Page, failure?: "drop" | "quota" | "malformed") {
  const sent: Array<{ body: Record<string, unknown>; key: string }> = [];
  await page.addInitScript(() =>
    localStorage.setItem("rods-leet-welcome-v1", "seen"),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown;
    if (path === "/api/session")
      body = { user: { id: "feedback-visitor" }, csrf: "feedback-csrf" };
    else if (path === "/api/dashboard")
      body = {
        ...guestDashboard(),
        profile: {
          id: "feedback-visitor",
          displayName: "Visitante",
          authenticated: true,
          anonymous: true,
        },
      };
    else if (path === "/api/challenges") body = challenges;
    else if (path === "/api/feedback") {
      sent.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      if (sent.length === 1 && failure === "drop") {
        await route.abort();
        return;
      }
      if (sent.length === 1 && failure === "quota") {
        await route.fulfill({
          status: 429,
          headers: { "Retry-After": "60" },
          json: {
            error: {
              code: "feedback_hourly_limit",
              message: "Limite atingido.",
            },
          },
        });
        return;
      }
      body =
        sent.length === 1 && failure === "malformed"
          ? { protocol: "invented", createdAt: "yesterday" }
          : receipt;
    } else body = [];
    await route.fulfill({ json: body });
  });
  return sent;
}
async function open(page: Page) {
  await page.goto(`${baseURL}/feedback?challengeId=concept-values`);
  await expect(
    page.getByRole("heading", { name: "Envie seu feedback" }),
  ).toBeVisible();
}
const message = "Gostaria de mais exemplos para praticar este conceito.";
const publicConsent = (page: Page) =>
  page.getByRole("checkbox", {
    name: "Concordo em publicar este feedback no canal geral do Discord.",
    exact: true,
  });

test("queues public feedback with explicit consent and context and shows only a confirmed protocol", async ({
  page,
}, info) => {
  const sent = await setup(page);
  await open(page);
  await expect(
    page.getByRole("checkbox", { name: /Incluir o desafio/ }),
  ).not.toBeChecked();
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.getByLabel(/E-mail para contato/)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Seu feedback será público no Discord" }),
  ).toBeVisible();
  await expect(publicConsent(page)).not.toBeChecked();
  await page.getByLabel("Mensagem", { exact: true }).fill(message);
  await page.getByLabel("Tipo de feedback").selectOption("praise");
  await publicConsent(page).check();
  await page.getByRole("checkbox", { name: /Incluir o desafio/ }).check();
  await page
    .getByRole("button", { name: "Enviar feedback", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Feedback recebido" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Protocolo:" }),
  ).toBeFocused();
  expect(sent).toHaveLength(1);
  expect(sent[0].body).toEqual({
    category: "praise",
    message,
    publishToDiscord: true,
    challengeId: "concept-values",
  });
  expect(sent[0].key).toMatch(/^[a-f0-9-]{36}$/);
  await expect(page.getByRole("status")).toContainText("fila de publicação");
  await expect(page.getByRole("status")).toContainText(
    "O protocolo confirma o recebimento",
  );
  await expect(
    page.getByText(
      /publicado com sucesso|mensagem publicada|enviado ao Discord/i,
    ),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/rods-feedback-success-dark-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ativar tema claro", exact: true })
    .click();
  await page.screenshot({
    path: `/tmp/rods-feedback-success-light-${info.project.name}.png`,
    fullPage: true,
  });
});

test("rejects short text and missing public consent without a feedback request", async ({
  page,
}) => {
  const sent = await setup(page);
  await open(page);
  await publicConsent(page).check();
  await page.getByLabel("Mensagem", { exact: true }).fill("curto");
  await page
    .getByRole("button", { name: "Enviar feedback", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("entre 10 e 4.000");
  expect(sent).toHaveLength(0);
  await page.getByLabel("Mensagem", { exact: true }).fill(message);
  await publicConsent(page).uncheck();
  await page
    .getByRole("button", { name: "Enviar feedback", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(/confirme|confirmação/i);
  expect(sent).toHaveLength(0);
});

test("a lost reply preserves and locks the message and reuses its key on retry", async ({
  page,
}, info) => {
  const sent = await setup(page, "drop");
  await open(page);
  await publicConsent(page).check();
  await page.getByLabel("Mensagem", { exact: true }).fill(message);
  await page
    .getByRole("button", { name: "Enviar feedback", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("não foi confirmado");
  await expect(
    page.getByRole("heading", { name: "Feedback recebido" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Mensagem", { exact: true })).toBeDisabled();
  await expect(publicConsent(page)).toBeDisabled();
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveValue(
    message,
  );
  await page.screenshot({
    path: `/tmp/rods-feedback-error-dark-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ativar tema claro", exact: true })
    .click();
  await page.screenshot({
    path: `/tmp/rods-feedback-error-light-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Feedback recebido" }),
  ).toBeVisible();
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
  expect(sent[0].body).toEqual({
    category: "suggestion",
    message,
    publishToDiscord: true,
  });
});

test("quota cooldown prevents immediate retries and then preserves the delivery key", async ({
  page,
}) => {
  await page.clock.install();
  const sent = await setup(page, "quota");
  await open(page);
  await publicConsent(page).check();
  await page.getByLabel("Mensagem", { exact: true }).fill(message);
  await page
    .getByRole("button", { name: "Enviar feedback", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("pelo menos um minuto");
  await expect(
    page.getByRole("button", { name: "Tentar novamente", exact: true }),
  ).toBeDisabled();
  expect(sent).toHaveLength(1);
  await page.clock.fastForward(60_001);
  await expect(
    page.getByRole("button", { name: "Tentar novamente", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Feedback recebido" }),
  ).toBeVisible();
  expect(sent[1]).toEqual(sent[0]);
});

test("a malformed receipt keeps delivery uncertain and does not celebrate success", async ({
  page,
}) => {
  const sent = await setup(page, "malformed");
  await open(page);
  await publicConsent(page).check();
  await page.getByLabel("Mensagem", { exact: true }).fill(message);
  await page
    .getByRole("button", { name: "Enviar feedback", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("não foi confirmado");
  await expect(
    page.getByRole("heading", { name: "Feedback recebido" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Mensagem", { exact: true })).toBeDisabled();
  await expect(publicConsent(page)).toBeDisabled();
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Feedback recebido" }),
  ).toBeVisible();
  expect(sent[1]).toEqual(sent[0]);
});
