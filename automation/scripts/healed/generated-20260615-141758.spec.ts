// Auto-healed by TCGen-Buddy.
// Run ID: generated-20260615-141758
// Failure Type: TEXT_ASSERTION_MISMATCH
import { test, expect } from '@playwright/test';

test('healable assertion mismatch probe', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.login_logo')).toHaveText(/swag labs/i);
});