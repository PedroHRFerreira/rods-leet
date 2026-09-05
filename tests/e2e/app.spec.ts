import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rods-leet-welcome-v1', 'seen'));
});

test('dashboard, navigation, theme and not-found page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Rods Leet/);
  await expect(page.getByRole('heading', { name: 'Vamos resolver o próximo.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comece por aqui' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await page.getByRole('button', { name: 'Ativar tema claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await page.getByRole('link', { name: 'Abrir desafio', exact: true }).click();
  await expect(page).toHaveURL(/\/desafios\/find-max/);
  await expect(page.getByRole('heading', { name: 'Maior pontuação da equipe', exact: true })).toBeVisible();
  await page.goto('/caminho-inexistente');
  await expect(page.getByRole('heading', { name: 'Este caminho ainda não existe' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('catalog filters all 50 challenges and ten learning tracks', async ({ page }) => {
  await page.goto('/desafios');
  await expect(page.locator('.catalog-challenge-card')).toHaveCount(50);
  await page.getByRole('group', { name: 'Filtrar por trilha' }).getByRole('button', { name: /^SQL/ }).click();
  await expect(page.locator('.catalog-challenge-card')).toHaveCount(10);
  await page.getByLabel('Dificuldade', { exact: true }).selectOption('hard');
  await expect(page.locator('.catalog-challenge-card')).toHaveCount(3);
  await page.getByLabel('Buscar no catálogo').fill('nao existe nenhum desafio assim');
  await expect(page.getByRole('heading', { name: 'Ainda não encontramos esse desafio' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver todos os desafios' }).click();
  await expect(page.locator('.catalog-challenge-card')).toHaveCount(50);
  await page.goto('/trilhas');
  await expect(page.getByRole('heading', { name: 'Trilhas de aprendizado' })).toBeVisible();
  await expect(page.locator('.track-card')).toHaveCount(4);
  await expect(page.locator('.upcoming-track')).toHaveCount(6);
});

test('Monaco loads and drafts survive refresh without grading locally', async ({ page }) => {
  await page.goto('/desafios/find-max');
  await expect(page.getByRole('heading', { name: 'Maior pontuação da equipe', exact: true })).toBeVisible();
  await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 30_000 });
  await page.locator('.monaco-editor textarea').first().focus();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('\n// digitado no Monaco');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('codegamer:editor:v1:guest:find-max:typescript'))).toContain('digitado no Monaco');
  await page.getByRole('button', { name: 'Editor simples', exact: true }).click();
  const code = page.getByRole('textbox', { name: /Código de/ });
  const source = 'export function findMax(values: readonly number[]): number | null {\n  // meu rascunho persistente\n  return null;\n}\n';
  await code.fill(source);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('codegamer:editor:v1:guest:find-max:typescript'))).toContain('meu rascunho persistente');
  await page.reload();
  await page.getByRole('button', { name: 'Editor simples', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /Código de/ })).toHaveValue(source);
  await page.getByRole('button', { name: 'Executar', exact: true }).click();
  await expect(page.locator('.arena-alert[role="alert"]')).toContainText('Entre com uma conta convidada');
  await expect(page.getByText('Solução aceita', { exact: true })).toHaveCount(0);
  await expect(page.locator('.mode-chip.locked')).toContainText('Fase 2');
  await page.getByRole('tab', { name: 'Gabarito', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Gabarito bloqueado' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Linguagem' }).selectOption('python');
  await expect(page).toHaveURL(/language=python/);
  await expect(page.getByRole('tab', { name: 'solution.py' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Linguagem' }).selectOption('typescript');
  await page.getByRole('button', { name: 'Editor simples', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /Código de/ })).toHaveValue(source);
});

test('two tabs preserve both drafts until an explicit choice', async ({ page, context }) => {
  await page.goto('/desafios/find-max');
  await page.getByRole('button', { name: 'Editor simples', exact: true }).click();
  await page.getByRole('textbox', { name: /Código de/ }).fill('// texto da primeira aba');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('codegamer:editor:v1:guest:find-max:typescript'))).toContain('texto da primeira aba');
  const second = await context.newPage();
  await second.goto('/desafios/find-max');
  await second.getByRole('button', { name: 'Editor simples', exact: true }).click();
  await expect(second.getByRole('textbox', { name: /Código de/ })).toHaveValue('// texto da primeira aba');
  await second.getByRole('textbox', { name: /Código de/ }).fill('// texto da segunda aba');
  await expect(page.getByRole('button', { name: 'Manter esta versão' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Código de/ })).toHaveValue('// texto da primeira aba');
  await page.getByRole('button', { name: 'Manter esta versão' }).click();
  await expect(second.getByRole('textbox', { name: /Código de/ })).toHaveValue('// texto da segunda aba');
  await expect(second.getByRole('button', { name: 'Manter esta versão' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('codegamer:editor:v1:guest:find-max:typescript'))).toContain('texto da primeira aba');
  await second.close();
});

test('SQL uses its own schema and language', async ({ page }) => {
  await page.goto('/desafios/sql-active-orders');
  await expect(page.getByRole('heading', { name: 'Pedidos confirmados', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estrutura dos dados' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Linguagem' })).toHaveValue('sql');
  await expect(page.getByRole('tab', { name: 'solution.sql' })).toBeVisible();
  await expect(page.locator('.problem-body')).toContainText('CREATE TABLE customers');
});

test('tutor, ranking and sign-in expose honest unavailable states', async ({ page }) => {
  await page.goto('/tutor');
  await page.getByRole('button', { name: 'Como organizar uma rotina de estudos?' }).click();
  await expect(page.getByRole('textbox', { name: 'Sua mensagem ao tutor' })).toHaveValue('Como organizar uma rotina de estudos?');
  await page.getByRole('button', { name: 'Enviar mensagem ao tutor' }).click();
  await expect(page.getByRole('alert')).toContainText('Entre com uma conta convidada');
  await page.goto('/ranking');
  const hero = page.locator('.ranking-hero');
  await expect(hero).toBeVisible();
  await expect.poll(() => hero.evaluate(element => element.clientWidth > 200 && element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Nenhuma pontuação registrada' })).toBeVisible();
  await expect(page.locator('.ranking-table tbody tr')).toHaveCount(0);
  await page.goto('/perfil');
  await page.getByRole('button', { name: 'Continuar com GitHub' }).click();
  await expect(page.getByRole('alert')).toContainText('O acesso por convite será liberado no beta');
});

test('keyboard navigation and responsive pages stay within the viewport', async ({ page }, testInfo) => {
  for (const path of ['/', '/desafios', '/trilhas', '/ranking', '/tutor', '/perfil', '/desafios/find-max']) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Abrir navegação' }).click();
    await expect(page.locator('#main-navigation')).toHaveClass(/is-open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#main-navigation')).not.toHaveClass(/is-open/);
    await expect(page.getByRole('button', { name: 'Abrir navegação' })).toBeFocused();
  }
});
