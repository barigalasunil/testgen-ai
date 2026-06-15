import { test, expect } from '@playwright/test';

test('healable locator local probe', async ({ page }) => {
  await page.setContent('<button id="login-button" data-test="login-button">Login</button>');
  await page.locator('#login-button-broken').click();
  await expect(page.getByTestId('login-button')).toBeVisible();
});