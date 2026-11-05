import { expect, test } from '@playwright/test';

test('build, save, restore, fly, check a concept, and unlock the next flight mission', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/flight?mission=flight-1');
  const launch = page.getByRole('button', { name: 'Launch aircraft ↗' });
  await expect(launch).toBeEnabled();
  await page.getByLabel('Attach a part').selectOption('cargo');
  await page.getByRole('button', { name: 'Above +Y' }).click();
  await expect(page.getByRole('status')).toContainText('Part attached');
  await expect(page.locator('.flight-section-title')).toContainText('16/128');
  await page.getByText('Aircraft files', { exact: true }).click();
  await page.getByRole('button', { name: 'Save locally' }).click();
  await expect(page.getByRole('status')).toContainText('Aircraft saved');
  await page.reload();
  await expect(launch).toBeEnabled();
  await page.getByText('Aircraft files', { exact: true }).click();
  await page.getByRole('button', { name: 'Restore save' }).click();
  await expect(page.locator('.flight-section-title')).toContainText('16/128');
  await page.getByRole('button', { name: /01 · Valley glider/ }).click();
  await launch.click();
  await expect
    .poll(async () => parseFloat(await page.locator('.flight-flightbar strong').innerText()), {
      timeout: 15000,
    })
    .toBeGreaterThan(95);
  await page.getByRole('button', { name: 'Finish & review' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'That idea worked.' })).toBeVisible();
  await page.getByRole('button', { name: /The wings create energy/ }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Try thinking');
  await page.getByRole('button', { name: /A decrease in gravitational potential energy/ }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Yes.');
  await page.getByRole('button', { name: 'Back to the workshop', exact: true }).click();
  await page.getByRole('button', { name: '← All workshops', exact: true }).click();
  await page.getByRole('button', { name: 'Explore flight missions' }).click();
  await expect(
    page.getByTestId('mission-card').nth(1).getByRole('button', { name: 'Start mission' }),
  ).toBeEnabled();
  await expect(page.getByTestId('mission-card').first()).toContainText('Concept checked');
  await page.reload();
  await page.getByRole('button', { name: 'Open notebook' }).click();
  await expect(page.locator('.notebook-stat').nth(1)).toContainText('1');
  expect(errors).toEqual([]);
});

test('the robot trains, sorts a held-out batch, trains an image model, and cancels safely', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/vision?mission=vision-1');
  const deploy = page.getByRole('button', { name: '▶ Deploy robot · 24 parts' });
  await expect(deploy).toBeEnabled({ timeout: 30000 });
  await deploy.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'That idea worked.' })).toBeVisible();
  await page.getByRole('button', { name: /The decision threshold/ }).click();
  await page.getByRole('button', { name: 'Back to the workshop', exact: true }).click();
  await page.getByRole('button', { name: '← Workshop hub' }).click();
  await page.getByRole('button', { name: 'Vision free play' }).click();
  await expect(deploy).toBeEnabled();
  await page.getByLabel('Input task').selectOption('image');
  await page.getByRole('button', { name: 'Next · configure brain →' }).click();
  await page.getByRole('button', { name: '↻ Train robot' }).click();
  await expect(deploy).toBeEnabled({ timeout: 30000 });
  await expect(page.locator('.vision-learning')).toContainText('last training');
  await page.getByText('Inside the active model', { exact: false }).click();
  await expect(page.getByRole('heading', { name: /Active convolution/ })).toBeVisible();
  await expect(page.locator('.vision-feature-maps > div')).toHaveCount(4);
  await page.getByLabel('Epochs').fill('60');
  await page.getByRole('button', { name: '↻ Train robot' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('cancelled');
  await page.getByRole('button', { name: 'Restore last model' }).click();
  await expect(deploy).toBeEnabled();
  await page.getByRole('button', { name: '← Workshop hub' }).click();
  await expect(page.getByRole('heading', { name: 'What happens if you try it?' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a locked deep link offers free play without granting completion', async ({ page }) => {
  await page.goto('/#/flight?mission=flight-6');
  await expect(page.getByRole('heading', { name: 'One experiment at a time.' })).toBeVisible();
  await page.getByRole('button', { name: 'Open free play' }).click();
  await expect(page.getByRole('button', { name: 'Launch aircraft ↗' })).toBeEnabled();
});

test('keyboard skip navigation keeps the active workshop open', async ({ page }) => {
  await page.goto('/#/flight');
  await expect(page.getByRole('button', { name: 'Launch aircraft ↗' })).toBeEnabled();
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/flight$/);
  await expect(page.getByRole('button', { name: 'Launch aircraft ↗' })).toBeVisible();
});
