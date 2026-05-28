import { test, expect, Page } from '@playwright/test';

class BasePage {
  constructor(protected readonly page: Page) {}

  readonly username = this.page.locator('[data-test="username"]');
  readonly password = this.page.locator('[data-test="password"]');
  readonly loginButton = this.page.locator('[data-test="login-button"]');
  readonly inventoryList = this.page.locator('.inventory_list');
  readonly cartBadge = this.page.locator('.shopping_cart_badge');
  readonly cartLink = this.page.locator('.shopping_cart_link');
  readonly cartItem = this.page.locator('.cart_item');
  readonly checkoutButton = this.page.locator('[data-test="checkout"]');
  readonly firstName = this.page.locator('[data-test="firstName"]');
  readonly lastName = this.page.locator('[data-test="lastName"]');
  readonly postalCode = this.page.locator('[data-test="postalCode"]');
  readonly continueButton = this.page.locator('[data-test="continue"]');
  readonly finishButton = this.page.locator('[data-test="finish"]');
  readonly cancelButton = this.page.locator('[data-test="cancel"]');
  readonly summaryTotalLabel = this.page.locator('.summary_total_label');
  readonly menuButton = this.page.locator('#react-burger-menu-btn');
  readonly logoutLink = this.page.locator('#logout_sidebar_link');
  readonly errorMessage = this.page.locator('[data-test="error"]');
  readonly productSortContainer = this.page.locator('.product_sort_container');
  readonly backpackAddButton = this.page.locator('[data-test="add-to-cart-sauce-labs-backpack"]');
  readonly bikeLightAddButton = this.page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]');
  readonly boltTShirtAddButton = this.page.locator('[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]');
  readonly backpackRemoveButton = this.page.locator('[data-test="remove-sauce-labs-backpack"]');
  readonly inventoryItemNames = this.page.locator('.inventory_item_name');
  readonly inventoryItemPrices = this.page.locator('.inventory_item_price');
  readonly checkoutCompleteHeader = this.page.locator('[data-test="complete-header"]');

  async gotoLogin() {
    await this.page.goto('https://www.saucedemo.com/');
  }

  async login(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }
}

test.describe('Sauce Demo POM E2E/Negative/Security/Boundary', () => {
  test('Successful end-to-end purchase for a standard user', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('standard_user', 'secret_sauce');
    await expect(app.inventoryList).toBeVisible();

    await app.backpackAddButton.click();
    await expect(app.cartBadge).toHaveText('1');

    await app.cartLink.click();
    await expect(app.cartItem).toBeVisible();

    await app.checkoutButton.click();
    await expect(app.firstName).toBeVisible();

    await app.firstName.fill('John');
    await app.lastName.fill('Doe');
    await app.postalCode.fill('12345');
    await app.continueButton.click();

    await expect(app.summaryTotalLabel).toBeVisible();
    await app.finishButton.click();

    await expect(app.checkoutCompleteHeader).toHaveText('Thank you for your order!');
    await expect(app.cartBadge).toBeHidden();
  });

  test('Login attempt with locked_out_user credentials', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('locked_out_user', 'secret_sauce');

    await expect(app.errorMessage).toHaveText('Epic sadface: Sorry, this user has been locked out.');
  });

  test('Login attempt with invalid username and valid password', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('invalid_user', 'secret_sauce');

    await expect(app.errorMessage).toHaveText('Epic sadface: Username and password do not match any user in this service.');
  });

  test('Login attempt with empty username and valid password', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('', 'secret_sauce');

    await expect(app.errorMessage).toHaveText('Epic sadface: Username is required');
  });

  test('Login attempt with valid username and empty password', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('standard_user', '');

    await expect(app.errorMessage).toHaveText('Epic sadface: Password is required');
  });

  test('Attempt to access inventory page directly without login', async ({ page }) => {
    const app = new BasePage(page);

    await page.goto('https://www.saucedemo.com/inventory.html');
    await expect(page).toHaveURL('https://www.saucedemo.com/');
    await expect(app.username).toBeVisible();
  });

  test('Verify login page elements are visible', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await expect(app.username).toBeVisible();
    await expect(app.password).toBeVisible();
    await expect(app.loginButton).toBeVisible();
  });

  test('Browse and add multiple items to the cart', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('standard_user', 'secret_sauce');
    await expect(app.inventoryList).toBeVisible();

    await app.backpackAddButton.click();
    await app.bikeLightAddButton.click();
    await app.boltTShirtAddButton.click();

    await expect(app.cartBadge).toHaveText('3');
    await expect(app.backpackRemoveButton).toHaveText('Remove');
    await expect(app.page.locator('[data-test="remove-sauce-labs-bike-light"]')).toHaveText('Remove');
    await expect(app.page.locator('[data-test="remove-sauce-labs-bolt-t-shirt"]')).toHaveText('Remove');
  });

  test('Sort products by Price (Low to High)', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('standard_user', 'secret_sauce');
    await expect(app.inventoryList).toBeVisible();

    await app.productSortContainer.selectOption({ label: 'Price (low to high)' });
    await expect(app.inventoryItemNames.first()).toHaveText('Sauce Labs Onesie');
    await expect(app.inventoryItemPrices.first()).toHaveText('$7.99');
  });

  test('Sort products by Name (Z-A)', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('standard_user', 'secret_sauce');
    await expect(app.inventoryList).toBeVisible();

    await app.productSortContainer.selectOption({ label: 'Name (Z to A)' });
    await expect(app.inventoryItemNames.first()).toBeVisible();
  });

  test('Remove an item from the cart', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('standard_user', 'secret_sauce');
    await expect(app.inventoryList).toBeVisible();

    await app.backpackAddButton.click();
    await expect(app.cartBadge).toHaveText('1');

    await app.backpackRemoveButton.click();
    await expect(app.page.locator('[data-test="add-to-cart-sauce-labs-backpack"]')).toHaveText('Add to cart');
    await expect(app.cartBadge).toBeHidden();
  });

  test('Proceed to checkout with empty customer information fields', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('standard_user', 'secret_sauce');
    await expect(app.inventoryList).toBeVisible();

    await app.backpackAddButton.click();
    await app.cartLink.click();
    await expect(app.cartItem).toBeVisible();

    await app.checkoutButton.click();
    await expect(app.firstName).toBeVisible();

    await app.continueButton.click();
    await expect(app.errorMessage).toHaveText('Error: First Name is required');
    await expect(app.firstName).toBeVisible();
  });

  test('Cancel checkout from the checkout overview page', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('standard_user', 'secret_sauce');
    await expect(app.inventoryList).toBeVisible();

    await app.backpackAddButton.click();
    await app.cartLink.click();
    await expect(app.cartItem).toBeVisible();

    await app.checkoutButton.click();
    await expect(app.firstName).toBeVisible();

    await app.firstName.fill('John');
    await app.lastName.fill('Doe');
    await app.postalCode.fill('12345');
    await app.continueButton.click();

    await expect(app.summaryTotalLabel).toBeVisible();
    await app.cancelButton.click();
    await expect(page).toHaveURL('https://www.saucedemo.com/cart.html');
  });

  test('Logout securely and verify redirection', async ({ page }) => {
    const app = new BasePage(page);

    await app.gotoLogin();
    await app.login('standard_user', 'secret_sauce');
    await expect(app.menuButton).toBeVisible();

    await app.menuButton.click();
    await app.logoutLink.click();

    await expect(page).toHaveURL('https://www.saucedemo.com/');
    await expect(app.username).toBeVisible();
    await expect(app.password).toBeVisible();
    await expect(app.loginButton).toBeVisible();
  });
});