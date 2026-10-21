import { expect, test } from '@playwright/test';

// hef-h1: 4 series de 90s de descanso entre series y 120s al finalizar el ejercicio.
const MODELO = 'hef-h1';

test('el runner informa los descansos configurados dentro del ejercicio', async ({ page }) => {
  await page.goto(`/run/${MODELO}`);

  await expect(page.getByText('descanso por serie 90s')).toBeVisible();
  await expect(page.getByText('descanso final 120s', { exact: true })).toBeVisible();
  await expect(page.getByText('descanso 90s', { exact: true }).first()).toBeVisible();
});

test('los descansos de la rutina no se editan en el runner', async ({ page }) => {
  await page.goto(`/run/${MODELO}`);

  await expect(page.getByLabel('Descanso entre series en segundos')).toHaveCount(0);
  await expect(page.getByLabel('Descanso entre ejercicios en segundos')).toHaveCount(0);
});

test('el descanso de serie usa el tiempo configurado de la rutina', async ({ page }) => {
  await page.goto(`/run/${MODELO}`);

  await page.getByPlaceholder('reps').first().fill('12');
  await page.getByRole('button', { name: 'confirmar' }).first().click();

  const descanso = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(descanso).toBeVisible();
  await expect(descanso).toContainText('Descanso de serie');
  await expect(descanso).toContainText('descanso configurado: 90s');

  await page.getByRole('button', { name: 'saltar descanso' }).click();
  await expect(descanso).toBeHidden();
});

test('al confirmar al pasar de ejercicio se respeta el descanso final', async ({ page }) => {
  await page.goto(`/run/${MODELO}`);

  await page.getByPlaceholder('reps').first().fill('12');
  await page.getByRole('button', { name: 'confirmar' }).first().click();
  await page.getByRole('button', { name: 'saltar descanso' }).click();

  await page.getByRole('button', { name: 'Siguiente' }).click();

  const descanso = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(descanso).toBeVisible();
  await expect(descanso).toContainText('Descanso al finalizar el ejercicio');
  await expect(descanso).toContainText('descanso configurado: 120s');

  await page.getByRole('button', { name: 'saltar descanso' }).click();
  await expect(page.getByRole('heading', { name: 'Flexiones en supino' })).toBeVisible();
});
