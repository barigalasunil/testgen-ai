# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: _generated_heal-verify.spec.ts >> generated heal verification should pass after locator healing
- Location: tests\_generated_heal-verify.spec.ts:3:5

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('#login-button-broken')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: Swag Labs
  - generic [ref=e5]:
    - generic [ref=e9]:
      - textbox "Username" [ref=e11]: standard_user
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
  1 | import { test, expect } from '@playwright/test';
  2 | 
  3 | test('generated heal verification should pass after locator healing', async ({ page }) => {
  4 |     await page.goto('https://www.saucedemo.com');
  5 |     await page.locator('#user-name').fill('standard_user');
  6 |     await page.locator('#password').fill('secret_sauce');
> 7 |     await page.locator('#login-button-broken').click();
    |                                                ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  8 |     await expect(page).toHaveURL(/inventory\.html/);
  9 | });
```