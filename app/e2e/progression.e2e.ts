import { expect, test, type Page } from '@playwright/test';

// fuerza-principiantes-benchmark: 5 bloques de un ejercicio, una serie cada uno y sin descanso.
const RUTINA = 'fuerza-principiantes-benchmark';
const EJERCICIOS = [
  'Dominadas pronas',
  'Fondos en paralelas',
  'Australian pull ups',
  'Flexiones en pica',
  'Leg raises colgado',
];

async function correrBenchmark(page: Page, reps: string[]) {
  await page.goto(`/run/${RUTINA}`);

  for (let i = 0; i < reps.length; i++) {
    await expect(page.getByRole('heading', { name: EJERCICIOS[i] })).toBeVisible();

    // La rutina no tiene descanso: ningún diálogo debe tapar el registro.
    await expect(page.getByRole('dialog', { name: 'Descanso en curso' })).toHaveCount(0);

    await page.getByPlaceholder('reps').first().fill(reps[i]);
    await page.getByRole('button', { name: 'confirmar' }).click();

    await expect(page.getByRole('dialog', { name: 'Descanso en curso' })).toHaveCount(0);

    const esUltimo = i === reps.length - 1;
    await page.getByRole('button', { name: esUltimo ? 'Finalizar entrenamiento' : 'Siguiente' }).click();

    if (!esUltimo) {
      await expect(page.getByRole('dialog', { name: 'Descanso en curso' })).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'series sin registrar' })).toHaveCount(0);
    }
  }
}

test('avanzar de nivel avisa, abre el nivel siguiente y lo marca completado', async ({ page }) => {
  await correrBenchmark(page, ['10', '10', '15', '8', '8']);

  await expect(page.getByText('Nivel desbloqueado', { exact: true })).toBeVisible();
  await expect(page.getByText('Fuerza Intermedia', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ir al siguiente nivel' })).toBeVisible();

  await page.getByRole('button', { name: 'Ir al siguiente nivel' }).click();

  await expect(page).toHaveURL('/program/fuerza-intermedios');
  await expect(page.getByText(/^Bloqueado:/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Fuerza Intermedia', level: 1 })).toBeVisible();

  await page.goto('/program/fuerza-principiantes');
  await expect(page.locator('header').getByText('completado', { exact: true })).toBeVisible();

  await page.goto('/skill/fuerza');
  const tarjetaPrincipiante = page
    .getByRole('link', { name: /Fuerza Principiante/ })
    .filter({ has: page.getByRole('heading', { name: 'Fuerza Principiante' }) });
  await expect(tarjetaPrincipiante).toContainText('completado');
});

test('no avanzar avisa qué marcas faltan', async ({ page }) => {
  await correrBenchmark(page, ['1', '1', '1', '1', '1']);

  await expect(page.getByText('Todavía no desbloqueás Fuerza Intermedia', { exact: true })).toBeVisible();

  const dominadas = page.locator('li').filter({ hasText: 'Dominadas pronas' });
  await expect(dominadas).toHaveCount(1);
  await expect(dominadas).toContainText('(mejor: 1)');

  await expect(page.getByText('Nivel desbloqueado', { exact: true })).toHaveCount(0);
});
