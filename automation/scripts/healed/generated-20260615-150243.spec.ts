// Auto-healed by TCGen-Buddy.
// Run ID: generated-20260615-150243
// Failure Type: LOCATOR_NOT_FOUND
import { test, expect } from '@playwright/test';

test('healable locator local probe', async ({ page }) => {
  await page.setContent('<button id="login-button" data-test="login-button">Login</button>');
  await page.getByRole('button', { name: /login/i }).click();
  await expect(page.getByTestId('login-button')).toBeVisible();
});