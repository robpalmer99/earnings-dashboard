import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('save a version, change a setting, load it back', async ({ page }) => {
  // Accept the save prompt (with the name) and every confirm dialog.
  page.on('dialog', (d) => d.accept('Test Version'));
  await page.goto('/');

  // Wait for the count-up animation (900 ms) to settle before capturing the value.
  await page.waitForTimeout(1100);
  const hero = page.locator('.card.hero .amount');
  const heroBefore = await hero.textContent();

  // Open the panel and save the current config as a version.
  await page.keyboard.press('Control+k');
  await page.locator('.cp-ver-save').click();
  await expect(page.locator('.cp-ver-name')).toHaveText('Test Version');

  // Change the available balance; the live balance card updates.
  const balInput = page.locator('.cp-field', { hasText: 'Available balance' }).locator('input');
  await balInput.fill('99999');
  await expect(page.locator('.balance .amount')).toHaveText('$99,999.00');

  // Load the saved version back; the balance and hero revert to the snapshot.
  await page.locator('.cp-ver', { hasText: 'Test Version' }).locator('.cp-btn', { hasText: 'Load' }).click();
  await expect(page.locator('.balance .amount')).toHaveText('$4,401.86');
  await expect(hero).toHaveText(heroBefore);
});
