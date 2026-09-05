import { expect, test } from '@playwright/test';

test('reload before debounce preserves pending code against a newer remote draft', async ({ page }) => {
  await page.route('**/desafios/find-max', async route => {
    if (!route.request().isNavigationRequest()) { await route.continue(); return; }
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/draft-harness.tsx"></script></body></html>' });
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('test:remote-draft')) localStorage.setItem('test:remote-draft', JSON.stringify({ challengeId: 'find-max', languageId: 'typescript', files: [{ path: 'solution.ts', content: '// versão original' }], revision: 2, updatedAt: '2026-01-01T00:00:00Z' }));
  });
  await page.goto('/desafios/find-max');
  await page.getByRole('button', { name: 'Editor simples', exact: true }).click();
  const editor = page.getByRole('textbox', { name: /Código de/ });
  await expect(editor).toHaveValue('// versão original');
  await editor.fill('// edição ainda não enviada');
  await page.evaluate(() => localStorage.setItem('test:remote-draft', JSON.stringify({ challengeId: 'find-max', languageId: 'typescript', files: [{ path: 'solution.ts', content: '// edição de outro dispositivo' }], revision: 3, updatedAt: '2030-01-01T00:00:00Z' })));
  // Reload immediately; the editor's 850ms network debounce has not elapsed.
  await page.reload();
  await page.getByRole('button', { name: 'Editor simples', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /Código de/ })).toHaveValue('// edição ainda não enviada');
  await expect(page.getByRole('button', { name: 'Manter esta versão' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('test:remote-draft')!).files[0].content)).toBe('// edição de outro dispositivo');
  await page.getByRole('button', { name: 'Manter esta versão' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('test:remote-draft')!).files[0].content)).toBe('// edição ainda não enviada');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('codegamer:editor:v1:test-user:find-max:typescript')!).localDirty)).toBe(false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('codegamer:editor:v1:test-user:find-max:typescript')!).revision)).toBe(4);
});
