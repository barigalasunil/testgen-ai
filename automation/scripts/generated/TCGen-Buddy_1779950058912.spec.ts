import { test, expect, Page, Locator } from '@playwright/test';

class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  protected locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async login(username: string, password: string): Promise<void> {
    await this.locator('[data-test="username"]').fill(username);
    await this.locator('[data-test="password"]').fill(password);
    await this.locator('[data-test="login-button"]').click();
  }
}

class LoginPage extends BasePage {
  readonly username = this.locator('[data-test="username"]');
  readonly password = this.locator('[data-test="password"]');
  readonly loginButton = this.locator('[data-test="login-button"]');
  readonly error = this.locator('[data-test="error"]');

  async open(): Promise<void> {
    await this.goto('https://www.saucedemo.com/');
  }
}

class InventoryPage extends BasePage {
  readonly inventoryList = this.locator('.inventory_list');
  readonly cartBadge = this.locator('.shopping_cart_badge');
  readonly cartLink = this.locator('.shopping_cart_link');
  readonly sortSelect = this.locator('.product_sort_container');
  readonly menuButton = this.locator('#react-burger-menu-btn');
  readonly logoutLink = this.locator('#logout_sidebar_link');

  productAddButton(slug: string): Locator {
    return this.locator(`[data-test="add-to-cart-${slug}"]`);
  }

  productRemoveButton(slug: string): Locator {
    return this.locator(`[data-test="remove-${slug}"]`);
  }

  async openFromLogin(): Promise<void> {
    await this.inventoryList.waitFor({ state: 'visible' });
  }
}

class CartPage extends BasePage {
  readonly cartItems = this.locator('.cart_item');
  readonly checkoutButton = this.locator('[data-test="checkout"]');
}

class CheckoutInfoPage extends BasePage {
  readonly firstName = this.locator('[data-test="firstName"]');
  readonly lastName = this.locator('[data-test="lastName"]');
  readonly postalCode = this.locator('[data-test="postalCode"]');
  readonly continueButton = this.locator('[data-test="continue"]');
  readonly error = this.locator('[data-test="error"]');
}

class CheckoutOverviewPage extends BasePage {
  readonly totalLabel = this.locator('.summary_total_label');
  readonly finishButton = this.locator('[data-test="finish"]');
  readonly cancelButton = this.locator('[data-test="cancel"]');
}

class CheckoutCompletePage extends BasePage {
  readonly completeHeader = this.locator('.complete-header');
  readonly cartBadge = this.locator('.shopping_cart_badge');
}

test.describe('SauceDemo POM starter suite', () => {
  test('Successful end-to-end purchase for a standard user', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);
    const checkoutInfoPage = new CheckoutInfoPage(page);
    const checkoutOverviewPage = new CheckoutOverviewPage(page);
    const checkoutCompletePage = new CheckoutCompletePage(page);

    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.openFromLogin();

    await inventoryPage.productAddButton('sauce-labs-backpack').click();
    await expect(inventoryPage.cartBadge).toHaveText('1');

    await inventoryPage.cartLink.click();
    await cartPage.cartItems.first().waitFor({ state: 'visible' });
    await cartPage.checkoutButton.click();

    await checkoutInfoPage.firstName.waitFor({ state: 'visible' });
    await checkoutInfoPage.firstName.fill('John');
    await checkoutInfoPage.lastName.fill('Doe');
    await checkoutInfoPage.postalCode.fill('12345');
    await checkoutInfoPage.continueButton.click();

    await checkoutOverviewPage.totalLabel.waitFor({ state: 'visible' });
    await checkoutOverviewPage.finishButton.click();

    await expect(checkoutCompletePage.completeHeader).toHaveText('Thank you for your order!');
    await expect(checkoutCompletePage.cartBadge).toBeHidden();
  });

  test('Login attempt with locked_out_user credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.open();
    await loginPage.login('locked_out_user', 'secret_sauce');

    await expect(loginPage.error).toHaveText('Epic sadface: Sorry, this user has been locked out.');
  });

  test('Login attempt with invalid username and valid password', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.open();
    await loginPage.login('invalid_user', 'secret_sauce');

    await expect(loginPage.error).toHaveText('Epic sadface: Username and password do not match any user in this service.');
  });

  test('Login attempt with empty username and valid password', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.open();
    await loginPage.login('', 'secret_sauce');

    await expect(loginPage.error).toHaveText('Epic sadface: Username is required');
  });

  test('Login attempt with valid username and empty password', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.open();
    await loginPage.login('standard_user', '');

    await expect(loginPage.error).toHaveText('Epic sadface: Password is required');
  });

  test('Attempt to access inventory page directly without login', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await page.goto('https://www.saucedemo.com/inventory.html');
    await expect(page).toHaveURL('https://www.saucedemo.com/');
    await expect(loginPage.username).toBeVisible();
  });

  test('Verify login page elements are visible', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.open();
    await expect(loginPage.username).toBeVisible();
    await expect(loginPage.password).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('Browse and add multiple items to the cart', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.openFromLogin();

    await inventoryPage.productAddButton('sauce-labs-backpack').click();
    await inventoryPage.productAddButton('sauce-labs-bike-light').click();
    await inventoryPage.productAddButton('sauce-labs-bolt-t-shirt').click();

    await expect(inventoryPage.cartBadge).toHaveText('3');
    await expect(inventoryPage.productRemoveButton('sauce-labs-backpack')).toHaveText('Remove');
    await expect(inventoryPage.productRemoveButton('sauce-labs-bike-light')).toHaveText('Remove');
    await expect(inventoryPage.productRemoveButton('sauce-labs-bolt-t-shirt')).toHaveText('Remove');
  });

  test('Sort products by Price (Low to High)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.openFromLogin();

    await inventoryPage.sortSelect.selectOption('lohi');
    await expect(page.locator('.inventory_item_name').first()).toHaveText('Sauce Labs Onesie');
    await expect(page.locator('.inventory_item_price').first()).toHaveText('$7.99');
  });

  test('Sort products by Name (Z-A)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.openFromLogin();

    await inventoryPage.sortSelect.selectOption('za');
    await expect(page.locator('.inventory_item_name').first()).toContainText('Z');
  });

  test('Remove an item from the cart', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.openFromLogin();

    await inventoryPage.productAddButton('sauce-labs-backpack').click();
    await expect(inventoryPage.cartBadge).toHaveText('1');

    await inventoryPage.productRemoveButton('sauce-labs-backpack').click();
    await expect(inventoryPage.productAddButton('sauce-labs-backpack')).toHaveText('Add to cart');
    await expect(inventoryPage.cartBadge).toBeHidden();
  });

  test('Proceed to checkout with empty customer information fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);
    const checkoutInfoPage = new CheckoutInfoPage(page);

    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.openFromLogin();

    await inventoryPage.productAddButton('sauce-labs-backpack').click();
    await inventoryPage.cartLink.click();
    await cartPage.cartItems.first().waitFor({ state: 'visible' });
    await cartPage.checkoutButton.click();

    await checkoutInfoPage.firstName.waitFor({ state: 'visible' });
    await checkoutInfoPage.continueButton.click();

    await expect(checkoutInfoPage.error).toHaveText('Error: First Name is required');
    await expect(page).toHaveURL(/checkout-step-one/);
  });

  test('Cancel checkout from the checkout overview page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);
    const checkoutInfoPage = new CheckoutInfoPage(page);
    const checkoutOverviewPage = new CheckoutOverviewPage(page);

    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.openFromLogin();

    await inventoryPage.productAddButton('sauce-labs-backpack').click();
    await inventoryPage.cartLink.click();
    await cartPage.cartItems.first().waitFor({ state: 'visible' });
    await cartPage.checkoutButton.click();

    await checkoutInfoPage.firstName.waitFor({ state: 'visible' });
    await checkoutInfoPage.firstName.fill('John');
    await checkoutInfoPage.lastName.fill('Doe');
    await checkoutInfoPage.postalCode.fill('12345');
    await checkoutInfoPage.continueButton.click();

    await checkoutOverviewPage.totalLabel.waitFor({ state: 'visible' });
    await checkoutOverviewPage.cancelButton.click();

    await expect(page).toHaveURL('https://www.saucedemo.com/cart.html');
  });

  test('Logout securely and verify redirection', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginPage.open();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.openFromLogin();

    await inventoryPage.menuButton.click();
    await inventoryPage.logoutLink.click();

    await expect(page).toHaveURL('https://www.saucedemo.com/');
    await expect(loginPage.username).toBeVisible();
    await expect(loginPage.password).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });
});