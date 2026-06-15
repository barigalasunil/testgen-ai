// Auto-healed by TCGen-Buddy.
// Run ID: generated-20260615-141442
// Failure Type: LOCATOR_NOT_FOUND
import { test, expect } from '@playwright/test';

test('healable assertion mismatch probe', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.login_logo:visible')).toHaveText('swag labs');
});