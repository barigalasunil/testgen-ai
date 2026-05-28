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

  async assertErrorMessageContains(text: string) {
    await expect(this.errorMessage).toContainText(text);
  }

  async assertLoginButtonVisible() {
    await expect(this.loginButton).toBeVisible();
  }

  async assertUsernameInputVisible() {
    await expect(this.usernameInput).toBeVisible();
  }

  async assertPasswordInputVisible() {
    await expect(this.passwordInput).toBeVisible();
  }
}

class InventoryPage {
  readonly page: Page;
  readonly inventoryList = this.page.locator('[class="inventory_list"]');
  readonly addToCartBackpack = this.page.locator('[data-test="add-to-cart-sauce-labs-backpack"]');
  readonly addToCartBikeLight = this.page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]');
  readonly addToCartBoltTShirt = this.page.locator('[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]');
  readonly removeBackpack = this.page.locator('[data-test="remove-sauce-labs-backpack"]');
  readonly productSortContainer = this.page.locator('[class="product_sort_container"]');
  readonly inventoryItemName = this.page.locator('[class="inventory_item_name"]');

  constructor(page: Page) {
    this.page = page;
  }

  async waitForInventoryListVisible() {
    await this.inventoryList.waitFor({ state: 'visible' });
  }

  async clickAddToCartBackpack() {
    await this.addToCartBackpack.click();
  }

  async clickAddToCartBikeLight() {
    await this.addToCartBikeLight.click();
  }

  async clickAddToCartBoltTShirt() {
    await this.addToCartBoltTShirt.click();
  }

  async clickRemoveBackpack() {
    await this.removeBackpack.click();
  }

  async selectSortOption(option: string) {
    await this.productSortContainer.selectOption(option);
  }

  async getFirstInventoryItemName() {
    return await this.inventoryItemName.first().textContent();
  }
}

class CartPage {
  readonly page: Page;
  readonly shoppingCartBadge = this.page.locator('[class="shopping_cart_badge"]');
  readonly shoppingCartLink = this.page.locator('[class="shopping_cart_link"]');
  readonly cartItem = this.page.locator('[class="cart_item"]');
  readonly checkoutButton = this.page.locator('[data-test="checkout"]');
  readonly removeButton = this.page.locator('[data-test="remove-sauce-labs-backpack"]');

  constructor(page: Page) {
    this.page = page;
  }

  async clickShoppingCartLink() {
    await this.shoppingCartLink.click();
  }

  async waitForCartItemVisible() {
    await this.cartItem.waitFor({ state: 'visible' });
  }

  async assertCartBadgeText(text: string) {
    await expect(this.shoppingCartBadge).toHaveText(text);
  }

  async assertCartBadgeNotVisible() {
    await expect(this.shoppingCartBadge).toBeHidden();
  }

  async clickCheckoutButton() {
    await this.checkoutButton.click();
  }

  async clickRemoveButton() {
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

  async waitForFirstNameInputVisible() {
    await this.firstNameInput.waitFor({ state: 'visible' });
  }

  async fillCustomerInformation(firstName: string, lastName: string, postalCode: string) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.postalCodeInput.fill(postalCode);
  }

  async clickContinueButton() {
    await this.continueButton.click();
  }

  async assertErrorMessageVisible() {
    await expect(this.errorMessage).toBeVisible();
  }

  async assertErrorMessageContains(text: string) {
    await expect(this.errorMessage).toContainText(text);
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

  async waitForSummaryTotalLabelVisible() {
    await this.summaryTotalLabel.waitFor({ state: 'visible' });
  }

  async clickFinishButton() {
    await this.finishButton.click();
  }

  async clickCancelButton() {
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

  async assertSuccessMessageContains(text: string) {
    await expect(this.successMessage).toContainText(text);
  }
}

class NavigationMenu {
  readonly page: Page;
  readonly burgerMenuButton = this.page.locator('[id="react-burger-menu-btn"]');
  readonly logoutSidebarLink = this.page.locator('[id="logout_sidebar_link"]');

  constructor(page: Page) {
    this.page = page;
  }

  async openMenu() {
    await this.burgerMenuButton.click();
  }

  async clickLogout() {
    await this.logoutSidebarLink.click();
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
    await inventoryPage.waitForInventoryListVisible();

    // 6. Click selector=[data-test="add-to-cart-sauce-labs-backpack"]
    await inventoryPage.clickAddToCartBackpack();

    // 7. Assert that selector=[class="shopping_cart_badge"] has text "1"
    await cartPage.assertCartBadgeText('1');

    // 8. Click selector=[class="shopping_cart_link"]
    await cartPage.clickShoppingCartLink();

    // 9. Wait for selector=[class="cart_item"] to be visible
    await cartPage.waitForCartItemVisible();

    // 10. Click selector=[data-test="checkout"]
    await cartPage.clickCheckoutButton();

    // 11. Wait for selector=[data-test="firstName"] to be visible
    await checkoutStepOnePage.waitForFirstNameInputVisible();

    // 12. Fill selector=[data-test="firstName"] with value="John"
    // 13. Fill selector=[data-test="lastName"] with value="Doe"
    // 14. Fill selector=[data-test="postalCode"] with value="12345"
    await checkoutStepOnePage.fillCustomerInformation('John', 'Doe', '12345');

    // 15. Click selector=[data-test="continue"]
    await checkoutStepOnePage.clickContinueButton();

    // 16. Wait for selector=[class="summary_total_label"] to be visible
    await checkoutStepTwoPage.waitForSummaryTotalLabelVisible();

    // 17. Click selector=[data-test="finish"]
    await checkoutStepTwoPage.clickFinishButton();

    // Expected Result: The user is redirected to the Order Confirmation page and the success message "Thank you for your order!" is displayed. The cart badge is no longer visible.
    await checkoutCompletePage.assertSuccessMessageVisible();
    await checkoutCompletePage.assertSuccessMessageContains('Thank you for your order!');
    await cartPage.assertCartBadgeNotVisible();
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
    await loginPage.assertErrorMessageContains('Epic sadface: Sorry, this user has been locked out.');
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
    await loginPage.assertErrorMessageContains('Epic sadface: Username and password do not match any user in this service.');
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
    await loginPage.assertErrorMessageContains('Epic sadface: Username is required');
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
    await loginPage.assertErrorMessageContains('Epic sadface: Password is required');
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
    await loginPage.assertUsernameInputVisible();

    // 3. Assert that selector=[data-test="password"] is visible
    await loginPage.assertPasswordInputVisible();

    // 4. Assert that selector=[data-test="login-button"] is visible
    await loginPage.assertLoginButtonVisible();

    // Expected Result: The username input field, password input field, and login button are all visible on the page.
  });

  test('Browse and add multiple items to the cart', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill selector=[data-test="username"] with value="standard_user"
    // 3. Fill selector=[data-test="password"] with value="secret_sauce"
    // 4. Click selector=[data-test="login-button"]
    await loginPage.login('standard_user', 'secret_sauce');

    // 5. Wait for selector=[class="inventory_list"] to be visible
    await inventoryPage.waitForInventoryListVisible();

    // 6. Click selector=[data-test="add-to-cart-sauce-labs-backpack"]
    await inventoryPage.clickAddToCartBackpack();

    // 7. Click selector=[data-test="add-to-cart-sauce-labs-bike-light"]
    await inventoryPage.clickAddToCartBikeLight();

    // 8. Click selector=[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]
    await inventoryPage.clickAddToCartBoltTShirt();

    // Expected Result: The cart badge displays '3'. The 'Add to Cart' buttons for the backpack, bike light, and bolt t-shirt have changed to 'Remove'.
    await cartPage.assertCartBadgeText('3');
    await expect(inventoryPage.removeBackpack).toBeVisible();
    await expect(page.locator('[data-test="remove-sauce-labs-bike-light"]')).toBeVisible();
    await expect(page.locator('[data-test="remove-sauce-labs-bolt-t-shirt"]')).toBeVisible();
  });

  test('Sort products by Price (Low to High)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();