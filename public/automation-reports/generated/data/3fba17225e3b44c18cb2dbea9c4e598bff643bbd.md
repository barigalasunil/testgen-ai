# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: _generated_TCGen-Buddy_1779954335489.spec.ts >> Successful end-to-end purchase for a standard user
- Location: tests\_generated_TCGen-Buddy_1779954335489.spec.ts:3:5

# Error details

```
TimeoutError: locator.fill: Timeout 15000ms exceeded.
Call log:
  - waiting for getByTestId('username')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: Swag Labs
  - generic [ref=e5]:
    - generic [ref=e9]:
      - textbox "Username" [ref=e11]
      - textbox "Password" [ref=e13]
      - button "Login" [ref=e15] [cursor=pointer]
    - generic [ref=e17]:
      - generic [ref=e18]:
        - heading "Accepted usernames are:" [level=4] [ref=e19]
        - text: standard_user
        - text: locked_out_user
        - text: problem_user
        - text: performance_glitch_user
        - text: error_user
        - text: visual_user
      - generic [ref=e20]:
        - heading "Password for all users:" [level=4] [ref=e21]
        - text: secret_sauce
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test('Successful end-to-end purchase for a standard user', async ({ page }) => {
  4   |   await page.goto('https://www.saucedemo.com/');
> 5   |   await page.getByTestId('username').fill('standard_user');
      |                                      ^ TimeoutError: locator.fill: Timeout 15000ms exceeded.
  6   |   await page.getByTestId('password').fill('secret_sauce');
  7   |   await page.getByTestId('login-button').click();
  8   |   await page.locator('.inventory_list').waitFor();
  9   |   await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  10  |   await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
  11  |   await page.locator('.shopping_cart_link').click();
  12  |   await page.locator('.cart_item').waitFor();
  13  |   await page.getByTestId('checkout').click();
  14  |   await page.getByTestId('firstName').waitFor();
  15  |   await page.getByTestId('firstName').fill('John');
  16  |   await page.getByTestId('lastName').fill('Doe');
  17  |   await page.getByTestId('postalCode').fill('12345');
  18  |   await page.getByTestId('continue').click();
  19  |   await page.locator('.summary_total_label').waitFor();
  20  |   await page.getByTestId('finish').click();
  21  |   await expect(page.locator('.complete-header')).toHaveText('Thank you for your order!');
  22  |   await expect(page.locator('.shopping_cart_badge')).not.toBeVisible();
  23  | });
  24  | 
  25  | test('Login attempt with locked_out_user credentials', async ({ page }) => {
  26  |   await page.goto('https://www.saucedemo.com/');
  27  |   await page.getByTestId('username').fill('locked_out_user');
  28  |   await page.getByTestId('password').fill('secret_sauce');
  29  |   await page.getByTestId('login-button').click();
  30  |   await expect(page.getByTestId('error')).toHaveText('Epic sadface: Sorry, this user has been locked out.');
  31  | });
  32  | 
  33  | test('Login attempt with invalid username and valid password', async ({ page }) => {
  34  |   await page.goto('https://www.saucedemo.com/');
  35  |   await page.getByTestId('username').fill('invalid_user');
  36  |   await page.getByTestId('password').fill('secret_sauce');
  37  |   await page.getByTestId('login-button').click();
  38  |   await expect(page.getByTestId('error')).toHaveText('Epic sadface: Username and password do not match any user in this service.');
  39  | });
  40  | 
  41  | test('Login attempt with empty username and valid password', async ({ page }) => {
  42  |   await page.goto('https://www.saucedemo.com/');
  43  |   await page.getByTestId('username').fill('');
  44  |   await page.getByTestId('password').fill('secret_sauce');
  45  |   await page.getByTestId('login-button').click();
  46  |   await expect(page.getByTestId('error')).toHaveText('Epic sadface: Username is required');
  47  | });
  48  | 
  49  | test('Login attempt with valid username and empty password', async ({ page }) => {
  50  |   await page.goto('https://www.saucedemo.com/');
  51  |   await page.getByTestId('username').fill('standard_user');
  52  |   await page.getByTestId('password').fill('');
  53  |   await page.getByTestId('login-button').click();
  54  |   await expect(page.getByTestId('error')).toHaveText('Epic sadface: Password is required');
  55  | });
  56  | 
  57  | test('Attempt to access inventory page directly without login', async ({ page }) => {
  58  |   await page.goto('https://www.saucedemo.com/inventory.html');
  59  |   await expect(page).toHaveURL('https://www.saucedemo.com/');
  60  |   await expect(page.getByTestId('username')).toBeVisible();
  61  | });
  62  | 
  63  | test('Verify login page elements are visible', async ({ page }) => {
  64  |   await page.goto('https://www.saucedemo.com/');
  65  |   await expect(page.getByTestId('username')).toBeVisible();
  66  |   await expect(page.getByTestId('password')).toBeVisible();
  67  |   await expect(page.getByTestId('login-button')).toBeVisible();
  68  | });
  69  | 
  70  | test('Browse and add multiple items to the cart', async ({ page }) => {
  71  |   await page.goto('https://www.saucedemo.com/');
  72  |   await page.getByTestId('username').fill('standard_user');
  73  |   await page.getByTestId('password').fill('secret_sauce');
  74  |   await page.getByTestId('login-button').click();
  75  |   await page.locator('.inventory_list').waitFor();
  76  |   await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  77  |   await page.getByTestId('add-to-cart-sauce-labs-bike-light').click();
  78  |   await page.getByTestId('add-to-cart-sauce-labs-bolt-t-shirt').click();
  79  |   await expect(page.locator('.shopping_cart_badge')).toHaveText('3');
  80  |   await expect(page.getByTestId('remove-sauce-labs-backpack')).toBeVisible();
  81  |   await expect(page.getByTestId('remove-sauce-labs-bike-light')).toBeVisible();
  82  |   await expect(page.getByTestId('remove-sauce-labs-bolt-t-shirt')).toBeVisible();
  83  | });
  84  | 
  85  | test('Sort products by Price (Low to High)', async ({ page }) => {
  86  |   await page.goto('https://www.saucedemo.com/');
  87  |   await page.getByTestId('username').fill('standard_user');
  88  |   await page.getByTestId('password').fill('secret_sauce');
  89  |   await page.getByTestId('login-button').click();
  90  |   await page.locator('.inventory_list').waitFor();
  91  |   await page.locator('.product_sort_container').selectOption('Price (Low to High)');
  92  |   await expect(page.locator('.inventory_item').first().locator('.inventory_item_name')).toHaveText('Sauce Labs Onesie');
  93  |   await expect(page.locator('.inventory_item').first().locator('.inventory_item_price')).toHaveText('$7.99');
  94  | });
  95  | 
  96  | test('Sort products by Name (Z-A)', async ({ page }) => {
  97  |   await page.goto('https://www.saucedemo.com/');
  98  |   await page.getByTestId('username').fill('standard_user');
  99  |   await page.getByTestId('password').fill('secret_sauce');
  100 |   await page.getByTestId('login-button').click();
  101 |   await page.locator('.inventory_list').waitFor();
  102 |   await page.locator('.product_sort_container').selectOption('Name (Z to A)');
  103 |   await expect(page.locator('.inventory_item').first().locator('.inventory_item_name')).toHaveText('Test.allTheThings() T-Shirt (Red)');
  104 | });
  105 | 
```