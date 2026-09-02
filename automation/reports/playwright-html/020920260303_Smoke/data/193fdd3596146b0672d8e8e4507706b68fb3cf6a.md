# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke\login.spec.ts >> SauceDemo Smoke >> login for performance_glitch_user should success
- Location: tests\smoke\login.spec.ts:10:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-test="login-button-broken"]')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: Swag Labs
  - generic [ref=e5]:
    - generic [ref=e9]:
      - textbox "Username" [ref=e11]: performance_glitch_user
      - textbox "Password" [active] [ref=e13]: secret_sauce
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
  1  | import { expect, Page } from '@playwright/test';
  2  | 
  3  | export class LoginPage {
  4  |   readonly page: Page;
  5  |   readonly usernameInput;
  6  |   readonly passwordInput;
  7  |   readonly loginButton;
  8  |   readonly errorMessage;
  9  | 
  10 |   constructor(page: Page) {
  11 |     this.page = page;
  12 |     this.usernameInput = page.locator('#user-name');
  13 |     this.passwordInput = page.locator('#password');
  14 |     this.loginButton = page.locator('[data-test="login-button-broken"]');
  15 |     this.errorMessage = page.locator('[data-test="error"]');
  16 |   }
  17 | 
  18 |   async goto() {
  19 |     await this.page.goto('/');
  20 |   }
  21 | 
  22 |   async login(username: string, password: string) {
  23 |     await this.usernameInput.fill(username);
  24 |     await this.passwordInput.fill(password);
> 25 |     await this.loginButton.click();
     |                            ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  26 |   }
  27 | 
  28 |   async expectLoggedIn() {
  29 |     await expect(this.page).toHaveURL(/.*inventory.html/);
  30 |     await expect(this.page.locator('.inventory_list')).toBeVisible();
  31 |   }
  32 | 
  33 |   async expectErrorMessage(message: string) {
  34 |     await expect(this.errorMessage).toHaveText(message);
  35 |   }
  36 | }
  37 | 
```