import { expect, test, type Page } from '@playwright/test';

interface SyncChange {
  entity: string;
  id: string;
  row?: { value?: unknown };
}

const WORKER_URL = 'http://127.0.0.1:8787';

/**
 * Waits until the local Worker actually holds `theme = value`. The settings popover's status
 * line only refreshes when a run finishes, so it cannot ack a debounced push; the server can.
 */
async function waitForServerTheme(page: Page, value: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`${WORKER_URL}/api/sync?since=0&limit=200`);
        const body = (await response.json()) as { changes?: SyncChange[] };
        return body.changes?.some(
          (change) =>
            change.entity === 'settings' && change.id === 'theme' && change.row?.value === value,
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

/**
 * Two devices, one mirror (S1, S6, S7, S9): device A toggles a setting, device B pulls it and
 * sees it in the UI, B changes it back, A gets the newer row on a manual sync.
 */
test('dos dispositivos comparten un ajuste en ambos sentidos', async ({ browser }) => {
  const deviceA = await browser.newContext();
  const pageA = await deviceA.newPage();
  await pageA.goto('/');
  await pageA.getByRole('button', { name: 'tomas' }).click();
  const dialogA = pageA.getByRole('dialog', { name: 'Ajustes' });

  const themeA = dialogA.getByLabel('Tema oscuro');
  await expect(themeA).not.toBeChecked();
  await themeA.check();
  await waitForServerTheme(pageA, 'dark');

  const deviceB = await browser.newContext();
  const pageB = await deviceB.newPage();
  await pageB.goto('/');
  await pageB.getByRole('button', { name: 'tomas' }).click();
  const dialogB = pageB.getByRole('dialog', { name: 'Ajustes' });

  await expect(dialogB.getByLabel('Tema oscuro')).toBeChecked({ timeout: 30_000 });
  await expect(pageB.locator('html')).toHaveClass(/dark/, { timeout: 30_000 });

  await dialogB.getByLabel('Tema oscuro').uncheck();
  await dialogB.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await waitForServerTheme(pageB, 'light');

  await pageA.reload();
  await pageA.getByRole('button', { name: 'tomas' }).click();
  const dialogA2 = pageA.getByRole('dialog', { name: 'Ajustes' });
  await dialogA2.getByRole('button', { name: 'Sincronizar ahora' }).click();

  await expect(dialogA2.getByLabel('Tema oscuro')).not.toBeChecked({ timeout: 30_000 });
  await expect(pageA.locator('html')).not.toHaveClass(/dark/);

  await deviceA.close();
  await deviceB.close();
});
