import { expect, test } from '@playwright/test';

test('the curriculum hub exposes both workshops, missions, and independent free play', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PLAY WITH THE BIG IDEAS.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FLIGHT WORKSHOP', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ROBOT VISION', exact: true })).toBeVisible();
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

test('game previews are loaded and stay within the viewport', async ({ page }) => {
  await page.goto('/');
  const previews = page.locator('.workshop-preview img');
  await expect(previews).toHaveCount(2);
  for (const preview of await previews.all()) {
    await expect(preview).toBeVisible();
    expect(
      await preview.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(100);
    const box = await preview.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
  }
});
