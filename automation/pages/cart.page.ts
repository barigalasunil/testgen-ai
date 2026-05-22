import { expect, Page } from '@playwright/test';

export class CartPage {
  readonly page: Page;
  readonly cartItems;
  readonly checkoutButton;

  constructor(page: Page) {
    this.page = page;
    this.cartItems = page.locator('.cart_item');
    this.checkoutButton = page.locator('[data-test="checkout"]');
  }

  async expectItemInCart(name: string) {
    const item = this.cartItems.filter({ hasText: name }).first();
    await expect(item).toBeVisible();
  }

  async checkout() {
    await this.checkoutButton.click();
    await expect(this.page).toHaveURL(/.*checkout-step-one.html/);
  }
}
