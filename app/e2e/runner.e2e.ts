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

// cardio-r1: superseries de 3 vueltas con 60s de descanso y sin descanso entre ejercicios.
test('el descanso al finalizar aparece tambien sin descanso entre ejercicios', async ({ page }) => {
  await page.goto('/run/cardio-r1');

  await expect(page.getByText('descanso final 60s', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  const descanso = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(descanso).toBeVisible();
  await expect(descanso).toContainText('Descanso al finalizar el ejercicio');
  await expect(descanso).toContainText('descanso configurado: 60s');
});

test('al pasar de ejercicio se avisa cuántas series se omiten', async ({ page }) => {
  await page.goto(`/run/${MODELO}`);

  await page.getByPlaceholder('reps').first().fill('12');
  await page.getByRole('button', { name: 'confirmar' }).first().click();
  await page.getByRole('button', { name: 'saltar descanso' }).click();

  await page.getByRole('button', { name: 'Siguiente' }).click();

  const modal = page.getByRole('dialog', { name: 'series sin registrar' });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Quedan 3 series sin registrar');
  await expect(modal).toContainText('se omiten');

  await page.getByRole('button', { name: 'Continuar' }).click();

  const descanso = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(descanso).toBeVisible();
  await expect(descanso).toContainText('descanso configurado: 120s');
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
  await page.getByRole('button', { name: 'Continuar' }).click();

  const descanso = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(descanso).toBeVisible();
  await expect(descanso).toContainText('Descanso al finalizar el ejercicio');
  await expect(descanso).toContainText('descanso configurado: 120s');

  await page.getByRole('button', { name: 'saltar descanso' }).click();
  await expect(page.getByRole('heading', { name: 'Flexiones en supino' })).toBeVisible();
});

test('el descanso final se espera al pasar al siguiente ejercicio, no al confirmar la serie', async ({ page }) => {
  await page.goto(`/run/${MODELO}`);

  // las tres primeras series disparan el descanso de serie
  for (let i = 0; i < 3; i++) {
    await page.getByPlaceholder('reps').nth(i).fill(String(10 + i));
    await page.getByRole('button', { name: 'confirmar' }).first().click();
    await page.getByRole('button', { name: 'saltar descanso' }).click();
  }

  // la última serie no dispara el descanso final
  await page.getByPlaceholder('reps').nth(3).fill('13');
  await page.getByRole('button', { name: 'confirmar' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Descanso en curso' })).toHaveCount(0);

  // "Siguiente" sí muestra el temporizador de descanso
  await page.getByRole('button', { name: 'Siguiente' }).click();
  const descanso = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(descanso).toBeVisible();
  await expect(descanso).toContainText('descanso configurado: 120s');
});
