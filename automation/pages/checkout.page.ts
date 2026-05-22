import { expect, Page } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly firstNameInput;
  readonly lastNameInput;
  readonly postalCodeInput;
  readonly continueButton;
  readonly finishButton;
  readonly completeHeader;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput = page.locator('[data-test="firstName"]');
    this.lastNameInput = page.locator('[data-test="lastName"]');
    this.postalCodeInput = page.locator('[data-test="postalCode"]');
    this.continueButton = page.locator('[data-test="continue"]');
    this.finishButton = page.locator('[data-test="finish"]');
    this.completeHeader = page.locator('.complete-header');
  }

  async fillCheckoutInformation(firstName: string, lastName: string, postalCode: string) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.postalCodeInput.fill(postalCode);
    await this.continueButton.click();
    await expect(this.page).toHaveURL(/.*checkout-step-two.html/);
  }

  async finishCheckout() {
    await this.finishButton.click();
  }

  async expectOrderComplete(expectedMessage: string) {
    await expect(this.completeHeader).toHaveText(expectedMessage);
  }
}
