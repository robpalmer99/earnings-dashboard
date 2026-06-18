import { test, expect } from '@playwright/test';

test('dashboard renders core surfaces', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card.hero .amount')).toBeVisible();
  await expect(page.locator('.graph svg .line')).toBeVisible();
  await expect(page.locator('.balance .btn-accent')).toBeVisible();
});

test('graph toggle switches period', async ({ page }) => {
  await page.goto('/');
  await page.locator('.toggle button', { hasText: 'Weekly' }).click();
  await expect(page.locator('.graph .title')).toHaveText(/Weekly/);
});

test('control panel opens and re-skins live', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const nameInput = page.locator('.cp-field', { hasText: 'Name' }).locator('input');
  await nameInput.fill('Acme Capital');
  await expect(page.locator('.brandbar .brand')).toContainText('Acme Capital');
});

test('randomize re-rolls the stats', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.card.hero .amount');
  const before = await hero.textContent();
  await page.keyboard.press('Control+k');
  await page.locator('.cp-actions button', { hasText: 'Randomize' }).click();
  await expect(hero).not.toHaveText(before);
});

test('withdraw flow reaches completion', async ({ page }) => {
  await page.goto('/');
  await page.locator('.balance .btn-accent').click();
  await page.locator('.wd-chip', { hasText: 'Max' }).click();
  await page.locator('.btn-accent', { hasText: 'Continue' }).click();
  await page.locator('.btn-accent', { hasText: 'Confirm withdrawal' }).click();
  await expect(page.locator('.wd-h', { hasText: 'Transfer complete!' })).toBeVisible({ timeout: 8000 });
});
