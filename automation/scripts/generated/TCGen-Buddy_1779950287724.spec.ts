import { test, expect, Page, Locator } from '@playwright/test';

class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }
}

class LoginPage extends BasePage {
  readonly username = this.page.locator('[data-test="username"]');
  readonly password = this.page.locator('[data-test="password"]');
  readonly loginButton = this.page.locator('[data-test="login-button"]');
  readonly error = this.page.locator('[data-test="error"]');

  async open(): Promise<void> {
    await this.goto('https://www.saucedemo.com/');
  }

  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }
}

class InventoryPage extends BasePage {
  readonly inventoryList = this.page.locator('.inventory_list');
  readonly cartBadge = this.page.locator('.shopping_cart_badge');
  readonly cartLink = this.page.locator('.shopping_cart_link');
  readonly sortSelect = this.page.locator('.product_sort_container');
  readonly menuButton = this.page.locator('#react-burger-menu-btn');
  readonly logoutLink = this.page.locator('#logout_sidebar_link');

  addToCartButton(item: string): Locator {
    return this.page.locator(`[data-test="add-to-cart-${item}"]`);
  }

  removeButton(item: string): Locator {
    return this.page.locator(`[data-test="remove-${item}"]`);
  }

  async waitForLoaded(): Promise<void> {
    await expect(this.inventoryList).toBeVisible();
  }

  async addItem(item: string): Promise<void> {
    await this.addToCartButton(item).click();
  }

  async removeItem(item: string): Promise<void> {
    await this.removeButton(item).click();
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }

  async sortBy(option: string): Promise<void> {
    await this.sortSelect.selectOption({ label: option });
  }

  async logout(): Promise<void> {
    await this.menuButton.click();
    await this.logoutLink.click();
  }
}

class CartPage extends BasePage {
  readonly cartItems = this.page.locator('.cart_item');
  readonly checkoutButton = this.page.locator('[data-test="checkout"]');

  async waitForLoaded(): Promise<void> {
    await expect(this.cartItems.first()).toBeVisible();
  }

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }
}

class CheckoutInformationPage extends BasePage {
  readonly firstName = this.page.locator('[data-test="firstName"]');
  readonly lastName = this.page.locator('[data-test="lastName"]');
  readonly postalCode = this.page.locator('[data-test="postalCode"]');
  readonly continueButton = this.page.locator('[data-test="continue"]');
  readonly error = this.page.locator('[data-test="error"]');

  async waitForLoaded(): Promise<void> {
    await expect(this.firstName).toBeVisible();
  }

  async fillCustomer(firstName: string, lastName: string, postalCode: string): Promise<void> {
    await this.firstName.fill(firstName);
    await this.lastName.fill(lastName);
    await this.postalCode.fill(postalCode);
  }

  async continue(): Promise<void> {
    await this.continueButton.click();
  }
}

class CheckoutOverviewPage extends BasePage {
  readonly totalLabel = this.page.locator('.summary_total_label');
  readonly finishButton = this.page.locator('[data-test="finish"]');
  readonly cancelButton = this.page.locator('[data-test="cancel"]');

  async waitForLoaded(): Promise<void> {
    await expect(this.totalLabel).toBeVisible();
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}

class CheckoutCompletePage extends BasePage {
  readonly completeHeader = this.page.locator('.complete-header');
  readonly cartBadge = this.page.locator('.shopping_cart_badge');

  async expectSuccess(): Promise<void> {
    await expect(this.completeHeader).toHaveText('Thank you for your order!');
    await expect(this.cartBadge).toHaveCount(0);
  }
}

test.describe('Sauce Demo E2E and security flows', () => {
  let loginPage: LoginPage;
  let inventoryPage: InventoryPage;
  let cartPage: CartPage;
  let checkoutInformationPage: CheckoutInformationPage;
  let checkoutOverviewPage: CheckoutOverviewPage;
  let checkoutCompletePage: CheckoutCompletePage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    inventoryPage = new InventoryPage(page);
    cartPage = new CartPage(page);
    checkoutInformationPage = new CheckoutInformationPage(page);
    checkoutOverviewPage = new CheckoutOverviewPage(page);
    checkoutCompletePage = new CheckoutCompletePage(page);
  });

  test('Successful end-to-end purchase for a standard user', async ({ page }) => {
    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.waitForLoaded();
    await inventoryPage.addItem('sauce-labs-backpack');
    await expect(inventoryPage.cartBadge).toHaveText('1');
    await inventoryPage.openCart();
    await cartPage.waitForLoaded();
    await cartPage.checkout();
    await checkoutInformationPage.waitForLoaded();
    await checkoutInformationPage.fillCustomer('John', 'Doe', '12345');
    await checkoutInformationPage.continue();
    await checkoutOverviewPage.waitForLoaded();
    await checkoutOverviewPage.finish();
    await checkoutCompletePage.expectSuccess();
  });

  test('Login attempt with locked_out_user credentials', async () => {
    await loginPage.open();
    await loginPage.login('locked_out_user', 'secret_sauce');
    await expect(loginPage.error).toHaveText('Epic sadface: Sorry, this user has been locked out.');
  });

  test('Login attempt with invalid username and valid password', async () => {
    await loginPage.open();
    await loginPage.login('invalid_user', 'secret_sauce');
    await expect(loginPage.error).toHaveText('Epic sadface: Username and password do not match any user in this service.');
  });

  test('Login attempt with empty username and valid password', async () => {
    await loginPage.open();
    await loginPage.login('', 'secret_sauce');
    await expect(loginPage.error).toHaveText('Epic sadface: Username is required');
  });

  test('Login attempt with valid username and empty password', async () => {
    await loginPage.open();
    await loginPage.login('standard_user', '');
    await expect(loginPage.error).toHaveText('Epic sadface: Password is required');
  });

  test('Attempt to access inventory page directly without login', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/inventory.html');
    await expect(page).toHaveURL('https://www.saucedemo.com/');
    await expect(loginPage.username).toBeVisible();
    await expect(loginPage.password).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('Verify login page elements are visible', async () => {
    await loginPage.open();
    await expect(loginPage.username).toBeVisible();
    await expect(loginPage.password).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('Browse and add multiple items to the cart', async () => {
    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.waitForLoaded();
    await inventoryPage.addItem('sauce-labs-backpack');
    await inventoryPage.addItem('sauce-labs-bike-light');
    await inventoryPage.addItem('sauce-labs-bolt-t-shirt');
    await expect(inventoryPage.cartBadge).toHaveText('3');
    await expect(inventoryPage.addToCartButton('sauce-labs-backpack')).toHaveText('Remove');
    await expect(inventoryPage.addToCartButton('sauce-labs-bike-light')).toHaveText('Remove');
    await expect(inventoryPage.addToCartButton('sauce-labs-bolt-t-shirt')).toHaveText('Remove');
  });

  test('Sort products by Price (Low to High)', async ({ page }) => {
    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.waitForLoaded();
    await inventoryPage.sortBy('Price (low to high)');
    await expect(page.locator('.inventory_item_name').first()).toHaveText('Sauce Labs Onesie');
    await expect(page.locator('.inventory_item_price').first()).toHaveText('$7.99');
  });

  test('Sort products by Name (Z-A)', async ({ page }) => {
    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.waitForLoaded();
    await inventoryPage.sortBy('Name (Z to A)');
    await expect(page.locator('.inventory_item_name').first()).toBeVisible();
  });

  test('Remove an item from the cart', async () => {
    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.waitForLoaded();
    await inventoryPage.addItem('sauce-labs-backpack');
    await expect(inventoryPage.cartBadge).toHaveText('1');
    await inventoryPage.removeItem('sauce-labs-backpack');
    await expect(inventoryPage.addToCartButton('sauce-labs-backpack')).toHaveText('Add to cart');
    await expect(inventoryPage.cartBadge).toHaveCount(0);
  });

  test('Proceed to checkout with empty customer information fields', async () => {
    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.waitForLoaded();
    await inventoryPage.addItem('sauce-labs-backpack');
    await inventoryPage.openCart();
    await cartPage.waitForLoaded();
    await cartPage.checkout();
    await checkoutInformationPage.waitForLoaded();
    await checkoutInformationPage.continue();
    await expect(checkoutInformationPage.error).toHaveText('Error: First Name is required');
    await expect(checkoutInformationPage.firstName).toBeVisible();
  });

  test('Cancel checkout from the checkout overview page', async ({ page }) => {
    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.waitForLoaded();
    await inventoryPage.addItem('sauce-labs-backpack');
    await inventoryPage.openCart();
    await cartPage.waitForLoaded();
    await cartPage.checkout();
    await checkoutInformationPage.waitForLoaded();
    await checkoutInformationPage.fillCustomer('John', 'Doe', '12345');
    await checkoutInformationPage.continue();
    await checkoutOverviewPage.waitForLoaded();
    await checkoutOverviewPage.cancel();
    await expect(page).toHaveURL('https://www.saucedemo.com/cart.html');
  });

  test('Logout securely and verify redirection', async ({ page }) => {
    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.waitForLoaded();
    await inventoryPage.logout();
    await expect(page).toHaveURL('https://www.saucedemo.com/');
    await expect(loginPage.username).toBeVisible();
    await expect(loginPage.password).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });
});