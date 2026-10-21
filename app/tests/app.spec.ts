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
