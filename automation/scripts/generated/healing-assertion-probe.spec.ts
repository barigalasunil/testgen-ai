import { test, expect } from '@playwright/test';

test('healable assertion mismatch probe', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.login_logo')).toHaveText('swag labs');
});