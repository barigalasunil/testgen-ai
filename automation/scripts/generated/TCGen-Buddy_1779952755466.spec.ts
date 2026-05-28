import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://www.saucedemo.com/';

class LoginPage {
  readonly page: Page;
  readonly usernameInput = this.page.locator('[data-test="username"]');
  readonly passwordInput = this.page.locator('[data-test="password"]');
  readonly loginButton = this.page.locator('[data-test="login-button"]');
  readonly errorMessage = this.page.locator('[data-test="error"]');

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async assertErrorMessageVisible() {
    await expect(this.errorMessage).toBeVisible();
  }

  async assertErrorMessageText(text: string) {
    await expect(this.errorMessage).toHaveText(text);
  }

  async assertLoginElementsVisible() {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.loginButton).toBeVisible();
  }
}

class InventoryPage {
  readonly page: Page;
  readonly inventoryList = this.page.locator('[class="inventory_list"]');
  readonly addToCartButtons = this.page.locator('[data-test^="add-to-cart-"]');
  readonly removeButtons = this.page.locator('[data-test^="remove-"]');
  readonly shoppingCartBadge = this.page.locator('[class="shopping_cart_badge"]');
  readonly productSortContainer = this.page.locator('[class="product_sort_container"]');

  constructor(page: Page) {
    this.page = page;
  }

  async waitForInventoryPage() {
    await this.inventoryList.waitFor({ state: 'visible' });
  }

  async addItemToCart(itemSelector: string) {
    await this.page.locator(`[data-test="add-to-cart-${itemSelector}"]`).click();
  }

  async removeItemFromCart(itemSelector: string) {
    await this.page.locator(`[data-test="remove-${itemSelector}"]`).click();
  }

  async assertCartBadgeText(text: string) {
    await expect(this.shoppingCartBadge).toHaveText(text);
  }

  async assertCartBadgeNotVisible() {
    await expect(this.shoppingCartBadge).not.toBeVisible();
  }

  async selectSortOption(option: string) {
    await this.productSortContainer.selectOption(option);
  }

  async assertFirstProductText(text: string) {
    await expect(this.page.locator('.inventory_item').first()).toContainText(text);
  }

  async assertAddToCartButtonsChangedToRemove() {
    await expect(this.removeButtons).toHaveCount(3);
  }
}

class CartPage {
  readonly page: Page;
  readonly cartItem = this.page.locator('[class="cart_item"]');
  readonly checkoutButton = this.page.locator('[data-test="checkout"]');
  readonly removeButton = this.page.locator('[data-test^="remove-"]');

  constructor(page: Page) {
    this.page = page;
  }

  async waitForCartPage() {
    await this.cartItem.waitFor({ state: 'visible' });
  }

  async clickCheckout() {
    await this.checkoutButton.click();
  }

  async clickRemoveItem() {
    await this.removeButton.click();
  }
}

class CheckoutStepOnePage {
  readonly page: Page;
  readonly firstNameInput = this.page.locator('[data-test="firstName"]');
  readonly lastNameInput = this.page.locator('[data-test="lastName"]');
  readonly postalCodeInput = this.page.locator('[data-test="postalCode"]');
  readonly continueButton = this.page.locator('[data-test="continue"]');
  readonly errorMessage = this.page.locator('[data-test="error"]');

  constructor(page: Page) {
    this.page = page;
  }

  async waitForCheckoutStepOnePage() {
    await this.firstNameInput.waitFor({ state: 'visible' });
  }

  async fillCustomerInfo(firstName: string, lastName: string, postalCode: string) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.postalCodeInput.fill(postalCode);
  }

  async clickContinue() {
    await this.continueButton.click();
  }

  async assertErrorMessageVisible() {
    await expect(this.errorMessage).toBeVisible();
  }

  async assertErrorMessageText(text: string) {
    await expect(this.errorMessage).toHaveText(text);
  }
}

class CheckoutStepTwoPage {
  readonly page: Page;
  readonly summaryTotalLabel = this.page.locator('[class="summary_total_label"]');
  readonly finishButton = this.page.locator('[data-test="finish"]');
  readonly cancelButton = this.page.locator('[data-test="cancel"]');

  constructor(page: Page) {
    this.page = page;
  }

  async waitForCheckoutStepTwoPage() {
    await this.summaryTotalLabel.waitFor({ state: 'visible' });
  }

  async clickFinish() {
    await this.finishButton.click();
  }

  async clickCancel() {
    await this.cancelButton.click();
  }
}

class CheckoutCompletePage {
  readonly page: Page;
  readonly successMessage = this.page.locator('[class="complete-header"]');

  constructor(page: Page) {
    this.page = page;
  }

  async assertSuccessMessageVisible() {
    await expect(this.successMessage).toBeVisible();
  }

  async assertSuccessMessageText(text: string) {
    await expect(this.successMessage).toHaveText(text);
  }
}

class SideBarMenu {
  readonly page: Page;
  readonly burgerMenuButton = this.page.locator('[id="react-burger-menu-btn"]');
  readonly logoutLink = this.page.locator('[id="logout_sidebar_link"]');

  constructor(page: Page) {
    this.page = page;
  }

  async openMenu() {
    await this.burgerMenuButton.click();
  }

  async clickLogout() {
    await this.logoutLink.click();
  }
}

test.describe('SauceDemo E2E Tests', () => {
  test('Successful end-to-end purchase for a standard user', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);
    const checkoutStepOnePage = new CheckoutStepOnePage(page);
    const checkoutStepTwoPage = new CheckoutStepTwoPage(page);
    const checkoutCompletePage = new CheckoutCompletePage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill selector=[data-test="username"] with value="standard_user"
    // 3. Fill selector=[data-test="password"] with value="secret_sauce"
    // 4. Click selector=[data-test="login-button"]
    await loginPage.login('standard_user', 'secret_sauce');

    // 5. Wait for selector=[class="inventory_list"] to be visible
    await inventoryPage.waitForInventoryPage();

    // 6. Click selector=[data-test="add-to-cart-sauce-labs-backpack"]
    await inventoryPage.addItemToCart('sauce-labs-backpack');

    // 7. Assert that selector=[class="shopping_cart_badge"] has text "1"
    await inventoryPage.assertCartBadgeText('1');

    // 8. Click selector=[class="shopping_cart_link"]
    await page.locator('[class="shopping_cart_link"]').click();

    // 9. Wait for selector=[class="cart_item"] to be visible
    await cartPage.waitForCartPage();

    // 10. Click selector=[data-test="checkout"]
    await cartPage.clickCheckout();

    // 11. Wait for selector=[data-test="firstName"] to be visible
    await checkoutStepOnePage.waitForCheckoutStepOnePage();

    // 12. Fill selector=[data-test="firstName"] with value="John"
    // 13. Fill selector=[data-test="lastName"] with value="Doe"
    // 14. Fill selector=[data-test="postalCode"] with value="12345"
    await checkoutStepOnePage.fillCustomerInfo('John', 'Doe', '12345');

    // 15. Click selector=[data-test="continue"]
    await checkoutStepOnePage.clickContinue();

    // 16. Wait for selector=[class="summary_total_label"] to be visible
    await checkoutStepTwoPage.waitForCheckoutStepTwoPage();

    // 17. Click selector=[data-test="finish"]
    await checkoutStepTwoPage.clickFinish();

    // Expected Result: The user is redirected to the Order Confirmation page and the success message "Thank you for your order!" is displayed. The cart badge is no longer visible.
    await checkoutCompletePage.assertSuccessMessageVisible();
    await checkoutCompletePage.assertSuccessMessageText('Thank you for your order!');
    await inventoryPage.assertCartBadgeNotVisible();
  });

  test('Login attempt with locked_out_user credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill selector=[data-test="username"] with value="locked_out_user"
    // 3. Fill selector=[data-test="password"] with value="secret_sauce"
    // 4. Click selector=[data-test="login-button"]
    await loginPage.login('locked_out_user', 'secret_sauce');

    // Expected Result: An error message "Epic sadface: Sorry, this user has been locked out." is displayed below the login form.
    await loginPage.assertErrorMessageVisible();
    await loginPage.assertErrorMessageText('Epic sadface: Sorry, this user has been locked out.');
  });

  test('Login attempt with invalid username and valid password', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill selector=[data-test="username"] with value="invalid_user"
    // 3. Fill selector=[data-test="password"] with value="secret_sauce"
    // 4. Click selector=[data-test="login-button"]
    await loginPage.login('invalid_user', 'secret_sauce');

    // Expected Result: An error message "Epic sadface: Username and password do not match any user in this service." is displayed below the login form.
    await loginPage.assertErrorMessageVisible();
    await loginPage.assertErrorMessageText('Epic sadface: Username and password do not match any user in this service.');
  });

  test('Login attempt with empty username and valid password', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill selector=[data-test="username"] with value=""
    // 3. Fill selector=[data-test="password"] with value="secret_sauce"
    // 4. Click selector=[data-test="login-button"]
    await loginPage.login('', 'secret_sauce');

    // Expected Result: An error message "Epic sadface: Username is required" is displayed below the login form.
    await loginPage.assertErrorMessageVisible();
    await loginPage.assertErrorMessageText('Epic sadface: Username is required');
  });

  test('Login attempt with valid username and empty password', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill selector=[data-test="username"] with value="standard_user"
    // 3. Fill selector=[data-test="password"] with value=""
    // 4. Click selector=[data-test="login-button"]
    await loginPage.login('standard_user', '');

    // Expected Result: An error message "Epic sadface: Password is required" is displayed below the login form.
    await loginPage.assertErrorMessageVisible();
    await loginPage.assertErrorMessageText('Epic sadface: Password is required');
  });

  test('Attempt to access inventory page directly without login', async ({ page }) => {
    // 1. Navigate to https://www.saucedemo.com/inventory.html
    await page.goto(`${BASE_URL}inventory.html`);

    // Expected Result: The user is redirected to the login page (https://www.saucedemo.com/).
    await expect(page).toHaveURL(BASE_URL);
  });

  test('Verify login page elements are visible', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Assert that selector=[data-test="username"] is visible
    // 3. Assert that selector=[data-test="password"] is visible
    // 4. Assert that selector=[data-test="login-button"] is visible
    await loginPage.assertLoginElementsVisible();
  });

  test('Browse and add multiple items to the cart', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill selector=[data-test="username"] with value="standard_user"
    // 3. Fill selector=[data-test="password"] with value="secret_sauce"
    // 4. Click selector=[data-test="login-button"]
    await loginPage.login('standard_user', 'secret_sauce');

    // 5. Wait for selector=[class="inventory_list"] to be visible
    await inventoryPage.waitForInventoryPage();

    // 6. Click selector=[data-test="add-to-cart-sauce-labs-backpack"]
    await inventoryPage.addItemToCart('sauce-labs-backpack');

    // 7. Click selector=[data-test="add-to-cart-sauce-labs-bike-light"]
    await inventoryPage.addItemToCart('sauce-labs-bike-light');

    // 8. Click selector=[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]
    await inventoryPage.addItemToCart('sauce-labs-bolt-t-shirt');

    // Expected Result: The cart badge displays '3'. The 'Add to Cart' buttons for the backpack, bike light, and bolt t-shirt have changed to 'Remove'.
    await inventoryPage.assertCartBadgeText('3');
    await inventoryPage.assertAddToCartButtonsChangedToRemove();
  });

  test('Sort products by Price (Low to High)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill selector=[data-test="username"] with value="standard_user"
    // 3. Fill selector=[data-test="password"] with value="secret_sauce"
    // 4. Click selector=[data-test="login-button"]
    await loginPage.login('standard_user', 'secret_sauce');

    // 5. Wait for selector=[class="inventory_list"] to be visible
    await inventoryPage.waitForInventoryPage();

    // 6. Select option "Price (Low to High)" from selector=[class="product_sort_container"]
    await inventoryPage.selectSortOption('Price (Low to High)');

    // Expected Result: The product list is reordered with the lowest priced items appearing first. The first product displayed is 'Sauce Labs Onesie' ($7.99).
    await inventoryPage.assertFirstProductText('Sauce Labs Onesie');
  });

  test('Sort products by Name (Z-A)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage