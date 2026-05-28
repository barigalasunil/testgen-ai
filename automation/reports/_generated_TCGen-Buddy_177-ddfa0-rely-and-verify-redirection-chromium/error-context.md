# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: _generated_TCGen-Buddy_1779954335489.spec.ts >> Logout securely and verify redirection
- Location: tests\_generated_TCGen-Buddy_1779954335489.spec.ts:154:5

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
  106 | test('Remove an item from the cart', async ({ page }) => {
  107 |   await page.goto('https://www.saucedemo.com/');
  108 |   await page.getByTestId('username').fill('standard_user');
  109 |   await page.getByTestId('password').fill('secret_sauce');
  110 |   await page.getByTestId('login-button').click();
  111 |   await page.locator('.inventory_list').waitFor();
  112 |   await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  113 |   await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
  114 |   await page.getByTestId('remove-sauce-labs-backpack').click();
  115 |   await expect(page.getByTestId('add-to-cart-sauce-labs-backpack')).toBeVisible();
  116 |   await expect(page.locator('.shopping_cart_badge')).not.toBeVisible();
  117 | });
  118 | 
  119 | test('Proceed to checkout with empty customer information fields', async ({ page }) => {
  120 |   await page.goto('https://www.saucedemo.com/');
  121 |   await page.getByTestId('username').fill('standard_user');
  122 |   await page.getByTestId('password').fill('secret_sauce');
  123 |   await page.getByTestId('login-button').click();
  124 |   await page.locator('.inventory_list').waitFor();
  125 |   await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  126 |   await page.locator('.shopping_cart_link').click();
  127 |   await page.locator('.cart_item').waitFor();
  128 |   await page.getByTestId('checkout').click();
  129 |   await page.getByTestId('firstName').waitFor();
  130 |   await page.getByTestId('continue').click();
  131 |   await expect(page.locator('[data-test="firstName"] + h3')).toHaveText('Error: First Name is required');
  132 | });
  133 | 
  134 | test('Cancel checkout from the checkout overview page', async ({ page }) => {
  135 |   await page.goto('https://www.saucedemo.com/');
  136 |   await page.getByTestId('username').fill('standard_user');
  137 |   await page.getByTestId('password').fill('secret_sauce');
  138 |   await page.getByTestId('login-button').click();
  139 |   await page.locator('.inventory_list').waitFor();
  140 |   await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  141 |   await page.locator('.shopping_cart_link').click();
  142 |   await page.locator('.cart_item').waitFor();
  143 |   await page.getByTestId('checkout').click();
  144 |   await page.getByTestId('firstName').waitFor();
  145 |   await page.getByTestId('firstName').fill('John');
  146 |   await page.getByTestId('lastName').fill('Doe');
  147 |   await page.getByTestId('postalCode').fill('12345');
  148 |   await page.getByTestId('continue').click();
  149 |   await page.locator('.summary_total_label').waitFor();
  150 |   await page.getByTestId('cancel').click();
  151 |   await expect(page).toHaveURL('https://www.saucedemo.com/cart.html');
  152 | });
  153 | 
  154 | test('Logout securely and verify redirection', async ({ page }) => {
  155 |   await page.goto('https://www.saucedemo.com/');
> 156 |   await page.getByTestId('username').fill('standard_user');
      |                                      ^ TimeoutError: locator.fill: Timeout 15000ms exceeded.
  157 |   await page.getByTestId('password').fill('secret_sauce');
  158 |   await page.getByTestId('login-button').click();
  159 |   await page.locator('#react-burger-menu-btn').waitFor();
  160 |   await page.locator('#react-burger-menu-btn').click();
  161 |   await page.locator('#logout_sidebar_link').click();
  162 |   await expect(page).toHaveURL('https://www.saucedemo.com/');
  163 |   await expect(page.getByTestId('username')).toBeVisible();
  164 | });
```