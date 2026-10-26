import { expect, test, type Page } from '@playwright/test';

// fuerza-principiantes-benchmark: 5 single-exercise blocks, one set each, no rest.
const ROUTINE = 'fuerza-principiantes-benchmark';
const EXERCISES = [
  'Dominadas pronas',
  'Fondos en paralelas',
  'Australian pull ups',
  'Flexiones en pica',
  'Leg raises colgado',
];

async function runBenchmark(page: Page, reps: string[]) {
  await page.goto(`/run/${ROUTINE}`);

  for (let i = 0; i < reps.length; i++) {
    await expect(page.getByRole('heading', { name: EXERCISES[i] })).toBeVisible();

    // The routine has no rest: no dialog should cover the set registration.
    await expect(page.getByRole('dialog', { name: 'Descanso en curso' })).toHaveCount(0);

    await page.getByPlaceholder('reps').first().fill(reps[i]);
    await page.getByRole('button', { name: 'confirmar' }).click();

    await expect(page.getByRole('dialog', { name: 'Descanso en curso' })).toHaveCount(0);

    const isLast = i === reps.length - 1;
    await page.getByRole('button', { name: isLast ? 'Finalizar' : 'Siguiente', exact: true }).click();

    if (!isLast) {
      await expect(page.getByRole('dialog', { name: 'Descanso en curso' })).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'series sin registrar' })).toHaveCount(0);
    }
  }
}

test('avanzar de nivel avisa, abre el nivel siguiente y lo marca completado', async ({ page }) => {
  await runBenchmark(page, ['10', '10', '15', '8', '8']);

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
  const beginnerCard = page
    .getByRole('link', { name: /Fuerza Principiante/ })
    .filter({ has: page.getByRole('heading', { name: 'Fuerza Principiante' }) });
  await expect(beginnerCard).toContainText('completado');
});

test('no avanzar avisa qué marcas faltan', async ({ page }) => {
  await runBenchmark(page, ['1', '1', '1', '1', '1']);

  await expect(page.getByText('Todavía no desbloqueás Fuerza Intermedia', { exact: true })).toBeVisible();

  const pullUps = page.locator('li').filter({ hasText: 'Dominadas pronas' });
  await expect(pullUps).toHaveCount(1);
  await expect(pullUps).toContainText('(mejor: 1)');

  await expect(page.getByText('Nivel desbloqueado', { exact: true })).toHaveCount(0);
});
