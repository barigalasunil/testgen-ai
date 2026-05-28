import { test, expect } from '@playwright/test';

test('Successful end-to-end purchase for a standard user', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'standard_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[class="inventory_list"]')).toBeVisible();
  await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  await expect(page.locator('[class="shopping_cart_badge"]')).toHaveText('1');
  await page.click('[class="shopping_cart_link"]');
  await expect(page.locator('[class="cart_item"]')).toBeVisible();
  await page.click('[data-test="checkout"]');
  await expect(page.locator('[data-test="firstName"]')).toBeVisible();
  await page.fill('[data-test="firstName"]', 'John');
  await page.fill('[data-test="lastName"]', 'Doe');
  await page.fill('[data-test="postalCode"]', '12345');
  await page.click('[data-test="continue"]');
  await expect(page.locator('[class="summary_total_label"]')).toBeVisible();
  await page.click('[data-test="finish"]');
  await expect(page.locator('h2[class="complete-header"]')).toHaveText('Thank you for your order!');
  await expect(page.locator('[class="shopping_cart_badge"]')).not.toBeVisible();
});

test('Login attempt with locked_out_user credentials', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'locked_out_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[data-test="error"]')).toHaveText('Epic sadface: Sorry, this user has been locked out.');
});

test('Login attempt with invalid username and valid password', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'invalid_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[data-test="error"]')).toHaveText('Epic sadface: Username and password do not match any user in this service.');
});

test('Login attempt with empty username and valid password', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', '');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[data-test="error"]')).toHaveText('Epic sadface: Username is required');
});

test('Login attempt with valid username and empty password', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'standard_user');
  await page.fill('[data-test="password"]', '');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[data-test="error"]')).toHaveText('Epic sadface: Password is required');
});

test('Attempt to access inventory page directly without login', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect(page).toHaveURL('https://www.saucedemo.com/');
  await expect(page.locator('[data-test="login-button"]')).toBeVisible();
});

test('Verify login page elements are visible', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await expect(page.locator('[data-test="username"]')).toBeVisible();
  await expect(page.locator('[data-test="password"]')).toBeVisible();
  await expect(page.locator('[data-test="login-button"]')).toBeVisible();
});

test('Browse and add multiple items to the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'standard_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[class="inventory_list"]')).toBeVisible();
  await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  await page.click('[data-test="add-to-cart-sauce-labs-bike-light"]');
  await page.click('[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]');
  await expect(page.locator('[class="shopping_cart_badge"]')).toHaveText('3');
  await expect(page.locator('[data-test="remove-sauce-labs-backpack"]')).toBeVisible();
  await expect(page.locator('[data-test="remove-sauce-labs-bike-light"]')).toBeVisible();
  await expect(page.locator('[data-test="remove-sauce-labs-bolt-t-shirt"]')).toBeVisible();
});

test('Sort products by Price (Low to High)', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'standard_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[class="inventory_list"]')).toBeVisible();
  await page.selectOption('[class="product_sort_container"]', 'Price (Low to High)');
  await expect(page.locator('.inventory_item').first().locator('.inventory_item_name')).toHaveText('Sauce Labs Onesie');
  await expect(page.locator('.inventory_item').first().locator('.inventory_item_price')).toHaveText('$7.99');
});

test('Sort products by Name (Z-A)', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'standard_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[class="inventory_list"]')).toBeVisible();
  await page.selectOption('[class="product_sort_container"]', 'Name (Z to A)');
  await expect(page.locator('.inventory_item').first().locator('.inventory_item_name')).toHaveText('Test.allTheThings() T-Shirt (Red)');
});

test('Remove an item from the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'standard_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[class="inventory_list"]')).toBeVisible();
  await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  await expect(page.locator('[class="shopping_cart_badge"]')).toHaveText('1');
  await page.click('[data-test="remove-sauce-labs-backpack"]');
  await expect(page.locator('[data-test="add-to-cart-sauce-labs-backpack"]')).toBeVisible();
  await expect(page.locator('[class="shopping_cart_badge"]')).not.toBeVisible();
});

test('Proceed to checkout with empty customer information fields', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'standard_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[class="inventory_list"]')).toBeVisible();
  await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  await page.click('[class="shopping_cart_link"]');
  await expect(page.locator('[class="cart_item"]')).toBeVisible();
  await page.click('[data-test="checkout"]');
  await expect(page.locator('[data-test="firstName"]')).toBeVisible();
  await page.click('[data-test="continue"]');
  await expect(page.locator('[data-test="firstName"] + h3[data-test="error"]')).toHaveText('Error: First Name is required');
  await expect(page).toHaveURL('https://www.saucedemo.com/checkout-step-one.html');
});

test('Cancel checkout from the checkout overview page', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'standard_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[class="inventory_list"]')).toBeVisible();
  await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
  await page.click('[class="shopping_cart_link"]');
  await expect(page.locator('[class="cart_item"]')).toBeVisible();
  await page.click('[data-test="checkout"]');
  await expect(page.locator('[data-test="firstName"]')).toBeVisible();
  await page.fill('[data-test="firstName"]', 'John');
  await page.fill('[data-test="lastName"]', 'Doe');
  await page.fill('[data-test="postalCode"]', '12345');
  await page.click('[data-test="continue"]');
  await expect(page.locator('[class="summary_total_label"]')).toBeVisible();
  await page.click('[data-test="cancel"]');
  await expect(page).toHaveURL('https://www.saucedemo.com/cart.html');
});

test('Logout securely and verify redirection', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('[data-test="username"]', 'standard_user');
  await page.fill('[data-test="password"]', 'secret_sauce');
  await page.click('[data-test="login-button"]');
  await expect(page.locator('[id="react-burger-menu-btn"]')).toBeVisible();
  await page.click('[id="react-burger-menu-btn"]');
  await page.click('[id="logout_sidebar_link"]');
  await expect(page).toHaveURL('https://www.saucedemo.com/');
  await expect(page.locator('[data-test="login-button"]')).toBeVisible();
});