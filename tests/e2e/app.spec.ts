import { expect, test } from '@playwright/test';

test('the curriculum hub exposes both workshops, missions, and independent free play', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What happens if you try it?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flight Workshop', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Robot Vision', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explore flight missions' }).click();
  await expect(page.getByTestId('mission-card')).toHaveCount(6);
  await expect(
    page.getByTestId('mission-card').first().getByRole('button', { name: 'Start mission' }),
  ).toBeEnabled();
  await expect(
    page.getByTestId('mission-card').nth(1).getByRole('button', { name: 'Locked' }),
  ).toBeDisabled();
});

test('sources and local progress backup controls are accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open notebook' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('link', { name: 'IB Physics guide' })).toHaveAttribute(
    'href',
    /ibo.org/,
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress' }).click();
  await expect((await download).suggestedFilename()).toBe('fieldwork-progress.json');
  await page.getByLabel('Import progress').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(page.getByRole('alert')).toContainText('not a valid');
});

test('workshop art badges stay compact and do not cover the illustrations', async ({ page }) => {
  await page.goto('/');
  const badges = page.locator('.art-tag');
  for (const badge of await badges.all()) {
    const box = await badge.boundingBox();
    expect(box!.height).toBeLessThan(36);
    expect(box!.width).toBeLessThan(230);
  }
});
