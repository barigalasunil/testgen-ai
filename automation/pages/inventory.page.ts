import { expect, Page } from '@playwright/test';

export class InventoryPage {
  readonly page: Page;
  readonly inventoryList;
  readonly cartBadge;
  readonly cartLink;

  constructor(page: Page) {
    this.page = page;
    this.inventoryList = page.locator('.inventory_list');
    this.cartBadge = page.locator('.shopping_cart_badge');
    this.cartLink = page.locator('.shopping_cart_link');
  }

  async expectLoggedIn() {
    await expect(this.inventoryList).toBeVisible();
  }

  async addFirstItemToCart(): Promise<string> {
    const firstItem = this.page.locator('.inventory_item').first();
    const itemName = (await firstItem.locator('.inventory_item_name').textContent())?.trim() || '';
    await firstItem.locator('button').click();
    return itemName;
  }

  async addItemToCartByName(name: string) {
    const item = this.page.locator('.inventory_item', { hasText: name }).first();
    await item.locator('button').click();
  }

  async expectCartCount(count: number) {
    await expect(this.cartBadge).toHaveText(String(count));
  }

  async openCart() {
    await this.cartLink.click();
    await expect(this.page).toHaveURL(/.*cart.html/);
  }
}
