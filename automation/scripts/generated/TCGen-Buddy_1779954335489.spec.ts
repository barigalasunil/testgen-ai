import { test, expect } from '@playwright/test';

test('Successful end-to-end purchase for a standard user', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_list').waitFor();
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
  await page.locator('.shopping_cart_link').click();
  await page.locator('.cart_item').waitFor();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').waitFor();
  await page.getByTestId('firstName').fill('John');
  await page.getByTestId('lastName').fill('Doe');
  await page.getByTestId('postalCode').fill('12345');
  await page.getByTestId('continue').click();
  await page.locator('.summary_total_label').waitFor();
  await page.getByTestId('finish').click();
  await expect(page.locator('.complete-header')).toHaveText('Thank you for your order!');
  await expect(page.locator('.shopping_cart_badge')).not.toBeVisible();
});

test('Login attempt with locked_out_user credentials', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('locked_out_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await expect(page.getByTestId('error')).toHaveText('Epic sadface: Sorry, this user has been locked out.');
});

test('Login attempt with invalid username and valid password', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('invalid_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await expect(page.getByTestId('error')).toHaveText('Epic sadface: Username and password do not match any user in this service.');
});

test('Login attempt with empty username and valid password', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await expect(page.getByTestId('error')).toHaveText('Epic sadface: Username is required');
});

test('Login attempt with valid username and empty password', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('');
  await page.getByTestId('login-button').click();
  await expect(page.getByTestId('error')).toHaveText('Epic sadface: Password is required');
});

test('Attempt to access inventory page directly without login', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect(page).toHaveURL('https://www.saucedemo.com/');
  await expect(page.getByTestId('username')).toBeVisible();
});

test('Verify login page elements are visible', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await expect(page.getByTestId('username')).toBeVisible();
  await expect(page.getByTestId('password')).toBeVisible();
  await expect(page.getByTestId('login-button')).toBeVisible();
});

test('Browse and add multiple items to the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_list').waitFor();
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  await page.getByTestId('add-to-cart-sauce-labs-bike-light').click();
  await page.getByTestId('add-to-cart-sauce-labs-bolt-t-shirt').click();
  await expect(page.locator('.shopping_cart_badge')).toHaveText('3');
  await expect(page.getByTestId('remove-sauce-labs-backpack')).toBeVisible();
  await expect(page.getByTestId('remove-sauce-labs-bike-light')).toBeVisible();
  await expect(page.getByTestId('remove-sauce-labs-bolt-t-shirt')).toBeVisible();
});

test('Sort products by Price (Low to High)', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_list').waitFor();
  await page.locator('.product_sort_container').selectOption('Price (Low to High)');
  await expect(page.locator('.inventory_item').first().locator('.inventory_item_name')).toHaveText('Sauce Labs Onesie');
  await expect(page.locator('.inventory_item').first().locator('.inventory_item_price')).toHaveText('$7.99');
});

test('Sort products by Name (Z-A)', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_list').waitFor();
  await page.locator('.product_sort_container').selectOption('Name (Z to A)');
  await expect(page.locator('.inventory_item').first().locator('.inventory_item_name')).toHaveText('Test.allTheThings() T-Shirt (Red)');
});

test('Remove an item from the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_list').waitFor();
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
  await page.getByTestId('remove-sauce-labs-backpack').click();
  await expect(page.getByTestId('add-to-cart-sauce-labs-backpack')).toBeVisible();
  await expect(page.locator('.shopping_cart_badge')).not.toBeVisible();
});

test('Proceed to checkout with empty customer information fields', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_list').waitFor();
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  await page.locator('.shopping_cart_link').click();
  await page.locator('.cart_item').waitFor();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').waitFor();
  await page.getByTestId('continue').click();
  await expect(page.locator('[data-test="firstName"] + h3')).toHaveText('Error: First Name is required');
});

test('Cancel checkout from the checkout overview page', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_list').waitFor();
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  await page.locator('.shopping_cart_link').click();
  await page.locator('.cart_item').waitFor();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').waitFor();
  await page.getByTestId('firstName').fill('John');
  await page.getByTestId('lastName').fill('Doe');
  await page.getByTestId('postalCode').fill('12345');
  await page.getByTestId('continue').click();
  await page.locator('.summary_total_label').waitFor();
  await page.getByTestId('cancel').click();
  await expect(page).toHaveURL('https://www.saucedemo.com/cart.html');
});

test('Logout securely and verify redirection', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('#react-burger-menu-btn').waitFor();
  await page.locator('#react-burger-menu-btn').click();
  await page.locator('#logout_sidebar_link').click();
  await expect(page).toHaveURL('https://www.saucedemo.com/');
  await expect(page.getByTestId('username')).toBeVisible();
});