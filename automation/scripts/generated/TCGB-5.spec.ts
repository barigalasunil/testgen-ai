import { test, expect } from '@playwright/test';

test('Happy path checkout flow with valid user information and correct order summary', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_item').nth(0).locator('button').click();
  await page.locator('.inventory_item').nth(1).locator('button').click();
  await page.locator('.shopping_cart_link').click();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('John');
  await page.getByTestId('lastName').fill('Doe');
  await page.getByTestId('postal-code').fill('12345');
  await page.getByTestId('continue').click();
  await expect(page.locator('.inventory_item_name')).toContainText(['Sauce Labs Backpack', 'Sauce Labs Bike Light']);
  await expect(page.locator('.summary_subtotal_label')).toHaveText('Item total: $50.00');
  await expect(page.locator('.summary_tax_label')).toHaveText('Tax: $5.00');
  await expect(page.locator('.summary_total_label')).toHaveText('Total: $55.00');
  await page.getByTestId('finish').click();
  await expect(page.locator('.complete-header')).toHaveText('THANK YOU FOR YOUR ORDER');
});

test('Prevent navigation when First Name is left blank', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_item').first().locator('button').click();
  await page.locator('.shopping_cart_link').click();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('');
  await page.getByTestId('lastName').fill('Doe');
  await page.getByTestId('postal-code').fill('12345');
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('error')).toHaveText(/First Name is required/);
  await expect(page.getByTestId('firstName')).toBeVisible();
});

test('Display error for invalid Zip Code format', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_item').first().locator('button').click();
  await page.locator('.shopping_cart_link').click();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('John');
  await page.getByTestId('lastName').fill('Doe');
  await page.getByTestId('postal-code').fill('12AB');
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('error')).toHaveText(/Zip Code must be numeric/);
});

test('Validate Zip Code length boundary (4 digits should be rejected)', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_item').first().locator('button').click();
  await page.locator('.shopping_cart_link').click();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('Jane');
  await page.getByTestId('lastName').fill('Smith');
  await page.getByTestId('postal-code').fill('1234');
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('error')).toHaveText(/Zip Code must be 5 digits/);
});

test('Prevent direct URL access to Overview without completing User Info', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/checkout-step-two.html');
  await expect(page).toHaveURL(/checkout-step-one/);
});

test('Preserve entered user information when using browser Back button from Overview', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_item').first().locator('button').click();
  await page.locator('.shopping_cart_link').click();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('John');
  await page.getByTestId('lastName').fill('Doe');
  await page.getByTestId('postal-code').fill('12345');
  await page.getByTestId('continue').click();
  await page.goBack();
  await expect(page.getByTestId('firstName')).toHaveValue('John');
  await expect(page.getByTestId('lastName')).toHaveValue('Doe');
  await expect(page.getByTestId('postal-code')).toHaveValue('12345');
  await page.getByTestId('continue').click();
  await expect(page.locator('.summary_total_label')).toBeVisible();
});

test('Cancel checkout at Overview and verify context is preserved on forward navigation', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_item').first().locator('button').click();
  await page.locator('.shopping_cart_link').click();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('John');
  await page.getByTestId('lastName').fill('Doe');
  await page.getByTestId('postal-code').fill('12345');
  await page.getByTestId('continue').click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.goForward();
  await expect(page.locator('.summary_total_label')).toBeVisible();
  await expect(page.locator('.inventory_item_name')).toContainText(['Sauce Labs Backpack']);
});