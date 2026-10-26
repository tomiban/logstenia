import { expect, test } from '@playwright/test';

test('la app carga la pantalla de hoy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hoy', level: 1 })).toBeVisible();
});

test('métricas explica qué falta cuando todavía no hay registros', async ({ page }) => {
  await page.goto('/metrics');
  await expect(page.getByRole('heading', { name: 'Todavía no hay nada que medir' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Empezar a entrenar' })).toBeVisible();
});

test('ajustes se abre desde el nombre del navbar y se cierra con Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'tomas' }).click();

  const dialog = page.getByRole('dialog', { name: 'Ajustes' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Sonido al terminar el descanso')).toBeVisible();
  await expect(dialog.getByLabel('Tema oscuro')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('ajustes muestra el estado de sincronización y el disparo manual', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'tomas' }).click();

  const dialog = page.getByRole('dialog', { name: 'Ajustes' });
  await expect(dialog.getByText('Sincronización', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText('Última sincronización:');
  await expect(dialog.getByRole('button', { name: 'Sincronizar ahora' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Exportar' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Importar' })).toBeVisible();
});

test('las pantallas de progreso y de ajustes ya no existen', async ({ page }) => {
  await page.goto('/progress');
  await expect(page).toHaveURL('/');
  await page.goto('/settings');
  await expect(page).toHaveURL('/');
});

test('no hay entradas de datos en la pantalla de métricas', async ({ page }) => {
  await page.goto('/metrics');
  await expect(page.locator('input, select, textarea')).toHaveCount(0);
});

test('la página scrollea como un documento, con rueda y con teclado', async ({ page }) => {
  await page.goto('/metrics');
  await expect(page.getByRole('heading', { name: 'Métricas', level: 1 })).toBeVisible();

  const scrollY = () => page.evaluate(() => window.scrollY);

  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 600);
  await expect.poll(scrollY).toBeGreaterThan(0);

  const afterWheel = await scrollY();
  await page.keyboard.press('PageDown');
  await expect.poll(scrollY).toBeGreaterThan(afterWheel);
});
