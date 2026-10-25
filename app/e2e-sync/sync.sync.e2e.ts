import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

/*
 * Two-device and two-owner sync suite (`design-plans/multi-user.md` §5).
 *
 * Runs the real Worker locally (isolated D1, Access bypass on loopback) behind the Vite
 * proxy. Under that bypass the only identity source is the `x-dev-owner` header, so each
 * browser context claims its own owner and the app never sees the header itself.
 */

const WORKER_URL = 'http://127.0.0.1:8787';
/** Read by the Worker only under the loopback development bypass (§5). */
const DEV_OWNER_HEADER = 'x-dev-owner';
/** Single block, one set, no rest: the shortest run that persists a session row. */
const BENCHMARK_ROUTE = '/run/handstand-benchmark';
const POLL = { timeout: 30_000 };

interface SyncChange {
  entity: string;
  id: string;
  row?: { value?: unknown };
}

interface Device {
  context: BrowserContext;
  page: Page;
}

/** One browser context = one device; `owner` is the identity its requests carry (§5). */
async function openDevice(browser: Browser, owner?: string): Promise<Device> {
  const context = await browser.newContext(
    owner === undefined ? {} : { extraHTTPHeaders: { [DEV_OWNER_HEADER]: owner } },
  );
  return { context, page: await context.newPage() };
}

/** Everything the Worker holds for `owner`, read through its public GET (§3, S1). */
async function serverSessionIds(page: Page, owner: string): Promise<string[]> {
  const response = await page.request.get(`${WORKER_URL}/api/sync?since=0&limit=200`, {
    headers: { [DEV_OWNER_HEADER]: owner },
  });
  if (!response.ok()) throw new Error(`GET /api/sync failed with ${response.status()}`);
  const body = (await response.json()) as { changes?: SyncChange[] };
  return (body.changes ?? [])
    .filter((change) => change.entity === 'sessions')
    .map((change) => change.id);
}

/** Waits for the mirror to hold exactly `expected` sessions for `owner`. */
async function waitForServerSessions(page: Page, owner: string, expected: number): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          return (await serverSessionIds(page, owner)).length;
        } catch {
          return -1;
        }
      },
      POLL,
    )
    .toBe(expected);
}

/** Waits for `owner`'s single session on the mirror and returns its id. */
async function waitForSingleSession(page: Page, owner: string): Promise<string> {
  await waitForServerSessions(page, owner, 1);
  const [session] = await serverSessionIds(page, owner);
  expect(session).toBeTruthy();
  return session as string;
}

/**
 * Finishes the benchmark run and waits until `owner`'s session reached the mirror.
 *
 * The finished screen shows before Dexie committed the row, so leaving the page right away
 * would drop the debounced push along with the page. Staying here lets the outbox drain and
 * the poll proves the write is durable, not just rendered.
 */
async function finishWorkout(page: Page, owner: string): Promise<void> {
  await page.goto(BENCHMARK_ROUTE);
  await page.getByRole('button', { name: 'Finalizar entrenamiento' }).click();
  await page
    .getByRole('dialog', { name: 'series sin registrar' })
    .getByRole('button', { name: 'Continuar' })
    .click();
  await expect(page.getByText('Entrenamiento terminado')).toBeVisible();
  await waitForServerSessions(page, owner, 1);
}

/**
 * Runs the engine from Settings and waits for the identity line. The `Sesión:` row is only
 * rendered once a pull answered with `user`, so it also proves the pull happened (§8, S2).
 */
async function syncFromSettings(device: Device, owner: string): Promise<void> {
  await device.page.goto('/');
  await device.page.getByRole('button', { name: 'tomas' }).click();
  const dialog = device.page.getByRole('dialog', { name: 'Ajustes' });
  await dialog.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await expect(dialog.getByText(`Sesión: ${owner}`, { exact: true })).toBeVisible(POLL);
  await device.page.keyboard.press('Escape');
}

/**
 * The `Sesiones` readout of `/metrics`. It starts at `0` and only shows the local count after
 * the page read Dexie, so asserting a number also waits for that read to settle.
 */
function sesionesReadout(page: Page): Locator {
  return page
    .getByRole('region', { name: 'Telemetría del período' })
    .getByText('Sesiones', { exact: true })
    .locator('xpath=following-sibling::div[1]');
}

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

/**
 * Isolation between two owners (S1, S2): A writes a session under `a@local` and B, pulling
 * under `b@local`, never receives it; the reverse direction holds too. Each context also
 * reports its own email, which is the identity the Worker derived from its header.
 */
test('dos owners no ven las sesiones del otro y sí las propias', async ({ browser }) => {
  const deviceA = await openDevice(browser, 'a@local');
  const deviceB = await openDevice(browser, 'b@local');

  try {
    await finishWorkout(deviceA.page, 'a@local');
    await syncFromSettings(deviceA, 'a@local');
    const sessionA = await waitForSingleSession(deviceA.page, 'a@local');

    // B asks the Worker for its own rows: A's session is not among them (S1).
    expect(await serverSessionIds(deviceB.page, 'b@local')).not.toContain(sessionA);

    await syncFromSettings(deviceB, 'b@local');
    expect(await serverSessionIds(deviceB.page, 'b@local')).not.toContain(sessionA);

    await finishWorkout(deviceB.page, 'b@local');
    await syncFromSettings(deviceB, 'b@local');
    const sessionB = await waitForSingleSession(deviceB.page, 'b@local');
    expect(sessionB).not.toBe(sessionA);

    // B counts only its own session: pulling A's row would make this two.
    await deviceB.page.goto('/metrics');
    await expect(sesionesReadout(deviceB.page)).toHaveText('1', POLL);

    // A keeps only its own row after B wrote and synced.
    await syncFromSettings(deviceA, 'a@local');
    expect(await serverSessionIds(deviceA.page, 'a@local')).toEqual([sessionA]);

    await deviceA.page.goto('/metrics');
    await expect(sesionesReadout(deviceA.page)).toHaveText('1', POLL);
  } finally {
    await deviceA.context.close();
    await deviceB.context.close();
  }
});

/**
 * Positive control (S2, §5): two contexts that claim the *same* owner do share rows, which
 * proves the isolation above comes from the owner and not from contexts being isolated.
 */
test('el mismo owner en dos contextos ve la misma sesión', async ({ browser }) => {
  const owner = 'shared@local';
  const deviceA = await openDevice(browser, owner);
  const deviceB = await openDevice(browser, owner);

  try {
    await finishWorkout(deviceA.page, owner);
    await syncFromSettings(deviceA, owner);
    const session = await waitForSingleSession(deviceA.page, owner);

    await syncFromSettings(deviceB, owner);
    expect(await serverSessionIds(deviceB.page, owner)).toEqual([session]);

    await deviceB.page.goto('/metrics');
    await expect(sesionesReadout(deviceB.page)).toHaveText('1', POLL);
  } finally {
    await deviceA.context.close();
    await deviceB.context.close();
  }
});
