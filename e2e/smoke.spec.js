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

test('randomize re-rolls the stats and the balance', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.card.hero .amount');
  const balance = page.locator('.balance .amount');
  await page.keyboard.press('Control+k');
  // Pin a manual balance override first — Randomize must still re-roll it,
  // otherwise a persisted balance stays frozen while the stats change.
  const balInput = page.locator('.cp-field', { hasText: 'Available balance' }).locator('input');
  await balInput.fill('4401.86');
  await expect(balance).toHaveText('$4,401.86');
  const heroBefore = await hero.textContent();
  await page.locator('.cp-actions button', { hasText: 'Randomize' }).click();
  await expect(hero).not.toHaveText(heroBefore);
  await expect(balance).not.toHaveText('$4,401.86');
});

test('withdraw flow reaches completion', async ({ page }) => {
  await page.goto('/');
  await page.locator('.balance .btn-accent').click();
  await page.locator('.wd-chip', { hasText: 'Max' }).click();
  await page.locator('.btn-accent', { hasText: 'Continue' }).click();
  await page.locator('.btn-accent', { hasText: 'Confirm withdrawal' }).click();
  await expect(page.locator('.wd-h', { hasText: 'Transfer complete!' })).toBeVisible({ timeout: 8000 });
});
