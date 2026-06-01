# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: _generated_TCGB-5.spec.ts >> Prevent direct URL access to Overview without completing User Info
- Location: tests\_generated_TCGB-5.spec.ts:70:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /checkout-step-one/
Received string:  "https://www.saucedemo.com/"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × unexpected value "https://www.saucedemo.com/"

```

```yaml
- text: Swag Labs
- textbox "Username"
- textbox "Password"
- 'heading "Epic sadface: You can only access ''/checkout-step-two.html'' when you are logged in." [level=3]':
  - button
  - text: "Epic sadface: You can only access '/checkout-step-two.html' when you are logged in."
- button "Login"
- heading "Accepted usernames are:" [level=4]
- text: standard_user locked_out_user problem_user performance_glitch_user error_user visual_user
- heading "Password for all users:" [level=4]
- text: secret_sauce
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test('Happy path checkout flow with valid user information and correct order summary', async ({ page }) => {
  4   |   await page.goto('https://www.saucedemo.com/');
  5   |   await page.getByTestId('username').fill('standard_user');
  6   |   await page.getByTestId('password').fill('secret_sauce');
  7   |   await page.getByTestId('login-button').click();
  8   |   await page.locator('.inventory_item').nth(0).locator('button').click();
  9   |   await page.locator('.inventory_item').nth(1).locator('button').click();
  10  |   await page.locator('.shopping_cart_link').click();
  11  |   await page.getByTestId('checkout').click();
  12  |   await page.getByTestId('firstName').fill('John');
  13  |   await page.getByTestId('lastName').fill('Doe');
  14  |   await page.getByTestId('postal-code').fill('12345');
  15  |   await page.getByTestId('continue').click();
  16  |   await expect(page.locator('.inventory_item_name')).toContainText(['Sauce Labs Backpack', 'Sauce Labs Bike Light']);
  17  |   await expect(page.locator('.summary_subtotal_label')).toHaveText('Item total: $50.00');
  18  |   await expect(page.locator('.summary_tax_label')).toHaveText('Tax: $5.00');
  19  |   await expect(page.locator('.summary_total_label')).toHaveText('Total: $55.00');
  20  |   await page.getByTestId('finish').click();
  21  |   await expect(page.locator('.complete-header')).toHaveText('THANK YOU FOR YOUR ORDER');
  22  | });
  23  | 
  24  | test('Prevent navigation when First Name is left blank', async ({ page }) => {
  25  |   await page.goto('https://www.saucedemo.com/');
  26  |   await page.getByTestId('username').fill('standard_user');
  27  |   await page.getByTestId('password').fill('secret_sauce');
  28  |   await page.getByTestId('login-button').click();
  29  |   await page.locator('.inventory_item').first().locator('button').click();
  30  |   await page.locator('.shopping_cart_link').click();
  31  |   await page.getByTestId('checkout').click();
  32  |   await page.getByTestId('firstName').fill('');
  33  |   await page.getByTestId('lastName').fill('Doe');
  34  |   await page.getByTestId('postal-code').fill('12345');
  35  |   await page.getByTestId('continue').click();
  36  |   await expect(page.getByTestId('error')).toHaveText(/First Name is required/);
  37  |   await expect(page.getByTestId('firstName')).toBeVisible();
  38  | });
  39  | 
  40  | test('Display error for invalid Zip Code format', async ({ page }) => {
  41  |   await page.goto('https://www.saucedemo.com/');
  42  |   await page.getByTestId('username').fill('standard_user');
  43  |   await page.getByTestId('password').fill('secret_sauce');
  44  |   await page.getByTestId('login-button').click();
  45  |   await page.locator('.inventory_item').first().locator('button').click();
  46  |   await page.locator('.shopping_cart_link').click();
  47  |   await page.getByTestId('checkout').click();
  48  |   await page.getByTestId('firstName').fill('John');
  49  |   await page.getByTestId('lastName').fill('Doe');
  50  |   await page.getByTestId('postal-code').fill('12AB');
  51  |   await page.getByTestId('continue').click();
  52  |   await expect(page.getByTestId('error')).toHaveText(/Zip Code must be numeric/);
  53  | });
  54  | 
  55  | test('Validate Zip Code length boundary (4 digits should be rejected)', async ({ page }) => {
  56  |   await page.goto('https://www.saucedemo.com/');
  57  |   await page.getByTestId('username').fill('standard_user');
  58  |   await page.getByTestId('password').fill('secret_sauce');
  59  |   await page.getByTestId('login-button').click();
  60  |   await page.locator('.inventory_item').first().locator('button').click();
  61  |   await page.locator('.shopping_cart_link').click();
  62  |   await page.getByTestId('checkout').click();
  63  |   await page.getByTestId('firstName').fill('Jane');
  64  |   await page.getByTestId('lastName').fill('Smith');
  65  |   await page.getByTestId('postal-code').fill('1234');
  66  |   await page.getByTestId('continue').click();
  67  |   await expect(page.getByTestId('error')).toHaveText(/Zip Code must be 5 digits/);
  68  | });
  69  | 
  70  | test('Prevent direct URL access to Overview without completing User Info', async ({ page }) => {
  71  |   await page.goto('https://www.saucedemo.com/checkout-step-two.html');
> 72  |   await expect(page).toHaveURL(/checkout-step-one/);
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  73  | });
  74  | 
  75  | test('Preserve entered user information when using browser Back button from Overview', async ({ page }) => {
  76  |   await page.goto('https://www.saucedemo.com/');
  77  |   await page.getByTestId('username').fill('standard_user');
  78  |   await page.getByTestId('password').fill('secret_sauce');
  79  |   await page.getByTestId('login-button').click();
  80  |   await page.locator('.inventory_item').first().locator('button').click();
  81  |   await page.locator('.shopping_cart_link').click();
  82  |   await page.getByTestId('checkout').click();
  83  |   await page.getByTestId('firstName').fill('John');
  84  |   await page.getByTestId('lastName').fill('Doe');
  85  |   await page.getByTestId('postal-code').fill('12345');
  86  |   await page.getByTestId('continue').click();
  87  |   await page.goBack();
  88  |   await expect(page.getByTestId('firstName')).toHaveValue('John');
  89  |   await expect(page.getByTestId('lastName')).toHaveValue('Doe');
  90  |   await expect(page.getByTestId('postal-code')).toHaveValue('12345');
  91  |   await page.getByTestId('continue').click();
  92  |   await expect(page.locator('.summary_total_label')).toBeVisible();
  93  | });
  94  | 
  95  | test('Cancel checkout at Overview and verify context is preserved on forward navigation', async ({ page }) => {
  96  |   await page.goto('https://www.saucedemo.com/');
  97  |   await page.getByTestId('username').fill('standard_user');
  98  |   await page.getByTestId('password').fill('secret_sauce');
  99  |   await page.getByTestId('login-button').click();
  100 |   await page.locator('.inventory_item').first().locator('button').click();
  101 |   await page.locator('.shopping_cart_link').click();
  102 |   await page.getByTestId('checkout').click();
  103 |   await page.getByTestId('firstName').fill('John');
  104 |   await page.getByTestId('lastName').fill('Doe');
  105 |   await page.getByTestId('postal-code').fill('12345');
  106 |   await page.getByTestId('continue').click();
  107 |   await page.getByRole('button', { name: 'Cancel' }).click();
  108 |   await page.goForward();
  109 |   await expect(page.locator('.summary_total_label')).toBeVisible();
  110 |   await expect(page.locator('.inventory_item_name')).toContainText(['Sauce Labs Backpack']);
  111 | });
```