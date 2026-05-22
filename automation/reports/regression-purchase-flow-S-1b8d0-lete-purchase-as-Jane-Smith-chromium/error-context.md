# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: regression\purchase-flow.spec.ts >> SauceDemo Regression >> complete purchase as Jane Smith
- Location: automation\tests\regression\purchase-flow.spec.ts:19:9

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('.complete-header')
Expected: "THANK YOU FOR YOUR ORDER"
Received: "Thank you for your order!"
Timeout:  5000ms

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('.complete-header')
    14 × locator resolved to <h2 class="complete-header" data-test="complete-header">Thank you for your order!</h2>
       - unexpected value "Thank you for your order!"

```

```yaml
- heading "Thank you for your order!" [level=2]
```

# Test source

```ts
  1  | import { expect, Page } from '@playwright/test';
  2  | 
  3  | export class CheckoutPage {
  4  |   readonly page: Page;
  5  |   readonly firstNameInput;
  6  |   readonly lastNameInput;
  7  |   readonly postalCodeInput;
  8  |   readonly continueButton;
  9  |   readonly finishButton;
  10 |   readonly completeHeader;
  11 | 
  12 |   constructor(page: Page) {
  13 |     this.page = page;
  14 |     this.firstNameInput = page.locator('[data-test="firstName"]');
  15 |     this.lastNameInput = page.locator('[data-test="lastName"]');
  16 |     this.postalCodeInput = page.locator('[data-test="postalCode"]');
  17 |     this.continueButton = page.locator('[data-test="continue"]');
  18 |     this.finishButton = page.locator('[data-test="finish"]');
  19 |     this.completeHeader = page.locator('.complete-header');
  20 |   }
  21 | 
  22 |   async fillCheckoutInformation(firstName: string, lastName: string, postalCode: string) {
  23 |     await this.firstNameInput.fill(firstName);
  24 |     await this.lastNameInput.fill(lastName);
  25 |     await this.postalCodeInput.fill(postalCode);
  26 |     await this.continueButton.click();
  27 |     await expect(this.page).toHaveURL(/.*checkout-step-two.html/);
  28 |   }
  29 | 
  30 |   async finishCheckout() {
  31 |     await this.finishButton.click();
  32 |   }
  33 | 
  34 |   async expectOrderComplete(expectedMessage: string) {
> 35 |     await expect(this.completeHeader).toHaveText(expectedMessage);
     |                                       ^ Error: expect(locator).toHaveText(expected) failed
  36 |   }
  37 | }
  38 | 
```