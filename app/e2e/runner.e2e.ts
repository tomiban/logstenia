import { expect, test } from '@playwright/test';

// hef-h1: 4 sets with 90s between sets and 120s after the exercise.
const MODEL = 'hef-h1';

test('el runner informa los descansos configurados dentro del ejercicio', async ({ page }) => {
  await page.goto(`/run/${MODEL}`);

  const telemetry = page.locator('dl').first();
  const pair = (term: string) => telemetry.locator('div').filter({ has: page.getByText(term, { exact: true }) });

  await expect(pair('Descanso')).toContainText('1 min 30 s');
  await expect(pair('Descanso final')).toContainText('2 min');
});

test('los descansos de la rutina no se editan en el runner', async ({ page }) => {
  await page.goto(`/run/${MODEL}`);

  await expect(page.getByLabel('Descanso entre series en segundos')).toHaveCount(0);
  await expect(page.getByLabel('Descanso entre ejercicios en segundos')).toHaveCount(0);
});

test('el slider de tiempo sigue el objetivo prescrito del ejercicio', async ({ page }) => {
  await page.goto('/run/pl-r2');

  // pl-r2 prescribes 20s: the ceiling is the prescribed hold, not an arbitrary number.
  await expect(page.getByLabel('Segundos serie 1')).toHaveAttribute('max', '20');
});

// cardio-r1: superseries of 3 rounds with 60s of rest and no rest between exercises.
test('el descanso al finalizar aparece tambien sin descanso entre ejercicios', async ({ page }) => {
  await page.goto('/run/cardio-r1');

  await expect(page.locator('dl').first()).toContainText('1 min');

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  const rest = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(rest).toBeVisible();
  await expect(rest).toContainText('Descanso al finalizar el ejercicio');
  await expect(rest).toContainText('descanso configurado: 60s');
});

test('al pasar de ejercicio se avisa cuántas series se omiten', async ({ page }) => {
  await page.goto(`/run/${MODEL}`);

  await page.getByPlaceholder('reps').first().fill('12');
  await page.getByRole('button', { name: 'confirmar' }).first().click();
  await page.getByRole('button', { name: 'saltar descanso' }).click();

  await page.getByRole('button', { name: 'Siguiente' }).click();

  const modal = page.getByRole('dialog', { name: 'series sin registrar' });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Quedan 3 series vacías');
  await expect(modal).toContainText('se omiten');

  await page.getByRole('button', { name: 'Continuar' }).click();

  const rest = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(rest).toBeVisible();
  await expect(rest).toContainText('descanso configurado: 120s');
});

test('cancelar el modal deja al usuario en el mismo ejercicio', async ({ page }) => {
  await page.goto(`/run/${MODEL}`);

  await page.getByRole('button', { name: 'Siguiente' }).click();

  const modal = page.getByRole('dialog', { name: 'series sin registrar' });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Quedan 4 series vacías');

  await page.getByRole('button', { name: 'Cancelar' }).click();

  await expect(modal).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Simulación curl Hefesto (banda detrás)' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Descanso en curso' })).toHaveCount(0);
});

test('al finalizar la rutina también se avisa cuántas series se omiten', async ({ page }) => {
  await page.goto('/run/cardio-r1');

  // cardio-r1 has 4 blocks of 4 exercises: advance until the last one
  for (let i = 0; i < 20; i++) {
    if (await page.getByRole('button', { name: 'Finalizar', exact: true }).count() > 0) break;
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('dialog', { name: 'series sin registrar' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    const hasRest = await page.getByRole('dialog', { name: 'Descanso en curso' })
      .waitFor({ state: 'visible', timeout: 1000 }).then(() => true).catch(() => false);
    if (hasRest) {
      await page.getByRole('button', { name: 'saltar descanso' }).click();
    }
  }

  await expect(page.getByRole('button', { name: 'Finalizar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();

  const modal = page.getByRole('dialog', { name: 'series sin registrar' });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('series sin registrar');

  await page.getByRole('button', { name: 'Continuar' }).click();
  const hasRest = await page.getByRole('dialog', { name: 'Descanso en curso' })
    .waitFor({ state: 'visible', timeout: 1000 }).then(() => true).catch(() => false);
  if (hasRest) {
    await page.getByRole('button', { name: 'saltar descanso' }).click();
  }
  await expect(page.getByText('Entrenamiento terminado')).toBeVisible();
});

test('el descanso de serie usa el tiempo configurado de la rutina', async ({ page }) => {
  await page.goto(`/run/${MODEL}`);

  await page.getByPlaceholder('reps').first().fill('12');
  await page.getByRole('button', { name: 'confirmar' }).first().click();

  const rest = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(rest).toBeVisible();
  await expect(rest).toContainText('Descanso de serie');
  await expect(rest).toContainText('descanso configurado: 90s');

  await page.getByRole('button', { name: 'saltar descanso' }).click();
  await expect(rest).toBeHidden();
});

test('al confirmar al pasar de ejercicio se respeta el descanso final', async ({ page }) => {
  await page.goto(`/run/${MODEL}`);

  await page.getByPlaceholder('reps').first().fill('12');
  await page.getByRole('button', { name: 'confirmar' }).first().click();
  await page.getByRole('button', { name: 'saltar descanso' }).click();

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  const rest = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(rest).toBeVisible();
  await expect(rest).toContainText('Descanso al finalizar el ejercicio');
  await expect(rest).toContainText('descanso configurado: 120s');

  await page.getByRole('button', { name: 'saltar descanso' }).click();
  await expect(page.getByRole('heading', { name: 'Flexiones en supino' })).toBeVisible();
});

test('el descanso final se espera al pasar al siguiente ejercicio, no al confirmar la serie', async ({ page }) => {
  await page.goto(`/run/${MODEL}`);

  // the first three sets trigger the between-sets rest
  for (let i = 0; i < 3; i++) {
    await page.getByPlaceholder('reps').nth(i).fill(String(10 + i));
    await page.getByRole('button', { name: 'confirmar' }).first().click();
    await page.getByRole('button', { name: 'saltar descanso' }).click();
  }

  // the last set does not trigger the closing rest
  await page.getByPlaceholder('reps').nth(3).fill('13');
  await page.getByRole('button', { name: 'confirmar' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Descanso en curso' })).toHaveCount(0);

  // "Siguiente" does show the rest timer
  await page.getByRole('button', { name: 'Siguiente' }).click();
  const rest = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(rest).toBeVisible();
  await expect(rest).toContainText('descanso configurado: 120s');
});

// cardio-r1: superseries of 4 isometric exercises, 3 rounds with 60s of rest per set.
test('el descanso de serie espera a que la vuelta esté completa', async ({ page }) => {
  await page.goto('/run/cardio-r1');

  const firstSet = page.getByLabel('Segundos serie 1', { exact: true });
  await expect(firstSet).toHaveCount(4);

  for (let exercise = 0; exercise < 3; exercise++) {
    await firstSet.nth(exercise).fill('12');
    await page.getByRole('button', { name: 'confirmar' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Descanso en curso' })).toHaveCount(0);
  }

  await firstSet.nth(3).fill('12');
  await page.getByRole('button', { name: 'confirmar' }).first().click();

  const rest = page.getByRole('dialog', { name: 'Descanso en curso' });
  await expect(rest).toBeVisible();
  await expect(rest).toContainText('Descanso de serie');
  await expect(rest).toContainText('descanso configurado: 60s');
});
