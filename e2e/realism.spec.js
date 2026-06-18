import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('no red deltas with default config', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cards .card')).toHaveCount(4);
  await expect(page.locator('.delta.down')).toHaveCount(0);
});

test('typed withdrawal: disabled continue, balance drops, payout row appears', async ({ page }) => {
  await page.goto('/');
  const amount = page.locator('.balance .amount');
  const parse = async () => Number((await amount.textContent()).replace(/[^0-9.]/g, ''));
  const before = await parse();
  await page.click('.balance .btn-accent');
  const cont = page.locator('button:has-text("Continue")');
  await expect(cont).toBeDisabled();
  await page.fill('.wd-input', '750');
  await expect(cont).toBeEnabled();
  await cont.click();
  await page.click('button:has-text("Confirm withdrawal")');
  await expect(page.locator('text=Transfer complete!')).toBeVisible({ timeout: 10000 });
  await page.click('button:has-text("Done")');
  expect(await parse()).toBeCloseTo(before - 750, 2);
  await expect(page.locator('.payouts .p-row').first()).toContainText('Just now');
});

test('monthly chart is a smooth multi-bucket curve (no triangle)', async ({ page }) => {
  await page.goto('/');
  await page.click('.toggle button:has-text("Monthly")');
  await page.waitForTimeout(700);
  const d = await page.locator('.graph .line').getAttribute('d');
  expect((d.match(/C/g) || []).length).toBeGreaterThanOrEqual(4);
});

test('graph tooltip appears on hover/tap', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1100);
  await page.locator('.graph svg').hover({ position: { x: 150, y: 80 } });
  await expect(page.locator('.graph .tip-text')).toHaveText(/\$[\d,]+/);
});

test('tab bar on mobile, hidden on desktop', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tabbar')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.tabbar')).toBeHidden();
});
