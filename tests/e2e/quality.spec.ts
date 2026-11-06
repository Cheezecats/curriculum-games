import { expect, test } from '@playwright/test';

test('aircraft edits can be undone and orbiting preserves the selected part', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/flight');
  await expect(page.getByRole('button', { name: 'Launch aircraft ↗' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Undo edit' })).toBeDisabled();
  await page.getByLabel('Attach a part').selectOption('cargo');
  await page.getByRole('button', { name: 'Above +Y' }).click();
  const selection = page.locator('.flight-sidebar details').first().locator('summary');
  await expect(selection).toContainText('Cargo');
  await expect(page.locator('.flight-section-title')).toContainText('16/128');
  await page.getByRole('button', { name: 'Undo edit' }).click();
  await expect(page.locator('.flight-section-title')).toContainText('15/128');
  await expect(selection).toContainText('Cockpit');
  await page.getByRole('button', { name: 'Redo edit' }).click();
  await expect(page.locator('.flight-section-title')).toContainText('16/128');
  await expect(selection).toContainText('Cargo');
  const box = await page.locator('.flight-stage canvas').boundingBox();
  await page.mouse.move(box!.x + 30, box!.y + 30);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(selection).toContainText('Cargo');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.getByRole('button', { name: 'Undo edit' }).click();
  await page.getByRole('button', { name: 'Above +Y' }).click();
  await expect(page.getByRole('button', { name: 'Redo edit' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('flight review shows measured objectives, units, a comparable retry and saved evidence', async ({
  page,
}) => {
  await page.goto('/#/flight?mission=flight-1');
  await expect(page.getByRole('list', { name: 'Objective evidence' })).toContainText('45 m');
  await page.getByRole('button', { name: 'Launch aircraft ↗' }).click();
  await page.keyboard.down('w');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('touched down too hard');
  await expect(
    dialog.getByRole('button', { name: 'Back to the workshop', exact: true }),
  ).toBeInViewport();
  await page.keyboard.up('w');
  await expect(dialog.getByRole('list', { name: 'Objective evidence' })).toContainText('Crashed');
  await expect(dialog).toContainText('Try one change');
  await page.getByRole('button', { name: 'Back to the workshop', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('touched down too hard');
  await expect(page.locator('.flight-scene-label')).not.toContainText('FINISH TO RECORD');
  await page.getByRole('button', { name: 'Fly again', exact: true }).click();
  await expect
    .poll(async () => parseFloat(await page.locator('.flight-flightbar strong').innerText()))
    .toBeGreaterThan(75);
  await page.getByRole('button', { name: 'Finish & review' }).click();
  await expect(dialog.getByRole('heading', { name: 'That idea worked.' })).toBeVisible();
  await expect(
    dialog.getByRole('list', { name: 'Objective evidence' }).locator('.criterion-unmet'),
  ).toHaveCount(0);
  await expect(dialog.getByRole('region', { name: 'Attempt comparison' })).toContainText(
    'Distance',
  );
  await expect(dialog.locator('.metric-cell')).toContainText([/m/, /s/]);
  await page.getByRole('button', { name: 'Back to the workshop', exact: true }).click();
  await expect(page.locator('.flight-scene-label')).not.toContainText('FINISH TO RECORD');
  await page.getByRole('button', { name: '← All workshops', exact: true }).click();
  await page.getByRole('button', { name: 'Open notebook' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress' }).click();
  const backup = await download;
  await backup.saveAs(test.info().outputPath('quality-progress.json'));
  const { readFile } = await import('node:fs/promises');
  const data = JSON.parse(await readFile(test.info().outputPath('quality-progress.json'), 'utf8'));
  expect(data.recentAttempts[0].criteria.length).toBeGreaterThan(0);
  expect(data.recentAttempts[0].configuration.task).toBe('flight');
  await page.reload();
  await page.getByRole('button', { name: 'Open notebook' }).click();
  await page.locator('.observation-details summary').first().click();
  await expect(
    page.getByRole('dialog').getByRole('list', { name: 'Objective evidence' }).first(),
  ).toContainText('Flight time');
});

test('robot sorting can pause and advance one measured decision at a time', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/#/vision?mission=vision-1');
  const deploy = page.getByRole('button', { name: '▶ Deploy robot · 24 parts' });
  await expect(deploy).toBeEnabled({ timeout: 30000 });
  await expect(page.locator('.vision-sensor-readings')).toContainText('Factory rule');
  await expect(page.locator('.vision-sensor-readings')).toContainText(/0\.\d{6}/);
  await deploy.click();
  await page.getByRole('button', { name: 'Pause belt', exact: true }).waitFor();
  await page.waitForTimeout(950);
  await expect(page.getByRole('button', { name: 'Pause belt', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Pause belt', exact: true }).click();
  const count = page.locator('.vision-scoreboard > div').first().locator('strong');
  const processed = async () =>
    Number((await count.innerText()).match(/\/\s*(\d+)\s+correct/i)![1]);
  const before = await processed();
  await page.waitForTimeout(750);
  expect(await processed()).toBe(before);
  await page.getByRole('button', { name: 'Step one part', exact: true }).click();
  await expect.poll(processed).toBe(before + 1);
  await page.waitForTimeout(750);
  expect(await processed()).toBe(before + 1);
  await expect(page.getByLabel('Latest sorting decision')).toBeVisible();
  await expect(page.getByLabel('Latest model scores').getByRole('meter')).toHaveCount(2);
  await page.getByRole('button', { name: 'Resume belt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'That idea worked.' })).toBeVisible({
    timeout: 30000,
  });
  await expect(dialog.getByRole('list', { name: 'Objective evidence' })).toContainText(
    /20\s*\/\s*24/,
  );
  await expect(dialog).toContainText('Batch accuracy');
  await page.getByRole('button', { name: 'Back to the workshop', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Vision workflow' })
    .getByRole('button', { name: /01\s*data/i })
    .click();
  await page.getByLabel('Input task').selectOption('image');
  await expect(page.getByRole('region', { name: 'Trained model status' })).toContainText(
    'No trained model ready',
  );
  await expect(page.locator('.vision-scoreboard > div').first()).toContainText('24 parts');
  await expect(page.locator('.vision-mistakes')).toHaveCount(0);
  await expect(page.locator('.vision-decision')).toHaveCount(0);
  await expect(page.locator('.vision-inspector')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Inspect selected model response ↓' }),
  ).toBeDisabled();
});

test('edited robot settings stay distinct from trained weights and inspectors identify real inputs', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/vision');
  const deploy = page.getByRole('button', { name: '▶ Deploy robot · 24 parts' });
  await expect(deploy).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Inspect selected model response ↓' }).click();
  await expect(page.getByLabel('Inspected model input')).toContainText('linear-train-base-0');
  await expect(page.getByLabel('Inspected model scores').getByRole('meter')).toHaveCount(2);
  await page.getByRole('button', { name: 'Next · configure brain →' }).click();
  await page.getByLabel('Epochs').fill('12');
  await page.getByLabel('Architecture').selectOption('mlp');
  await expect(page.getByTestId('vision-draft-status')).toContainText('Draft changed');
  await expect(page.getByRole('region', { name: 'Trained model status' })).toContainText(
    'PERCEPTRON',
  );
  await expect(page.getByRole('region', { name: 'Trained model status' })).toContainText(
    '45 completed epochs',
  );
  await expect(deploy).toBeEnabled();
  await page.getByRole('button', { name: '↻ Train robot' }).click();
  await expect(page.getByTestId('vision-draft-status')).toContainText('Draft matches', {
    timeout: 30000,
  });
  await expect(page.getByRole('region', { name: 'Trained model status' })).toContainText('MLP');
  await expect(page.getByRole('region', { name: 'Trained model status' })).toContainText(
    '12 completed epochs',
  );
  await page
    .getByRole('navigation', { name: 'Vision workflow' })
    .getByRole('button', { name: /01\s*data/i })
    .click();
  await page.getByLabel('Input task').selectOption('image');
  await page.getByRole('button', { name: 'Next · configure brain →' }).click();
  await page.getByRole('button', { name: '↻ Train robot' }).click();
  await expect(deploy).toBeEnabled({ timeout: 30000 });
  await page
    .getByRole('navigation', { name: 'Vision workflow' })
    .getByRole('button', { name: /01\s*data/i })
    .click();
  await page.getByRole('button', { name: 'Inspect selected model response ↓' }).click();
  await expect(page.getByLabel('Inspected model input')).toContainText('image-train-base-0');
  await expect(page.getByLabel('Inspected model scores').getByRole('meter')).toHaveCount(3);
  await expect(page.locator('.vision-feature-maps > div')).toHaveCount(4);
  await page
    .getByRole('navigation', { name: 'Vision workflow' })
    .getByRole('button', { name: /02\s*train/i })
    .click();
  await page.getByLabel('Epochs').fill('60');
  await page.getByRole('button', { name: '↻ Train robot' }).click();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await expect(page.locator('.vision-learning')).toContainText(/Epoch\s+[1-9]/);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Restore last model' }).click();
  await expect(deploy).toBeEnabled({ timeout: 30000 });
  await expect(page.getByRole('region', { name: 'Trained model status' })).toContainText(
    '16 completed epochs',
  );
  await expect(page.locator('.vision-learning')).not.toContainText(/Epoch\s+[1-9]/);
  expect(errors).toEqual([]);
});
