// Auto-healed by TCGen-Buddy.
// Run ID: 020920260313_Generated
// Failure Type: LOCATOR_NOT_FOUND
import { test, expect } from '@playwright/test';

test('generated heal verification should pass after locator healing', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.locator('#user-name').fill('standard_user');
    await page.locator('#password').fill('secret_sauce');
    await page.getByTestId('login-button').click();
    await expect(page).toHaveURL(/inventory\.html/);
});