import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://www.saucedemo.com/';

class LoginPage {
  readonly page: Page;

  // Placeholder selectors
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

  async assertUsernameInputVisible() {
    await expect(this.usernameInput).toBeVisible();
  }

  async assertPasswordInputVisible() {
    await expect(this.passwordInput).toBeVisible();
  }

  async assertLoginButtonVisible() {
    await expect(this.loginButton).toBeVisible();
  }
}

class InventoryPage {
  readonly page: Page;

  // Placeholder selectors
  readonly inventoryList = this.page.locator('[class="inventory_list"]');
  readonly addToCartBackpack = this.page.locator('[data-test="add-to-cart-sauce-labs-backpack"]');
  readonly addToCartBikeLight = this.page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]');
  readonly addToCartBoltTShirt = this.page.locator('[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]');
  readonly removeButtonBackpack = this.page.locator('[data-test="remove-sauce-labs-backpack"]');
  readonly shoppingCartBadge = this.page.locator('[class="shopping_cart_badge"]');
  readonly shoppingCartLink = this.page.locator('[class="shopping_cart_link"]');
  readonly productSortContainer = this.page.locator('[class="product_sort_container"]');

  constructor(page: Page) {
    this.page = page;
  }

  async waitForInventoryListVisible() {
    await expect(this.inventoryList).toBeVisible();
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

  async clickRemoveButtonBackpack() {
    await this.removeButtonBackpack.click();
  }

  async assertShoppingCartBadgeText(text: string) {
    await expect(this.shoppingCartBadge).toHaveText(text);
  }

  async assertShoppingCartBadgeNotVisible() {
    await expect(this.shoppingCartBadge).not.toBeVisible();
  }

  async clickShoppingCartLink() {
    await this.shoppingCartLink.click();
  }

  async selectSortOption(option: string) {
    await this.productSortContainer.selectOption(option);
  }
}

class CartPage {
  readonly page: Page;

  // Placeholder selectors
  readonly cartItem = this.page.locator('[class="cart_item"]');
  readonly checkoutButton = this.page.locator('[data-test="checkout"]');
  readonly cancelButton = this.page.locator('[data-test="cancel"]');

  constructor(page: Page) {
    this.page = page;
  }

  async waitForCartItemVisible() {
    await expect(this.cartItem).toBeVisible();
  }

  async clickCheckoutButton() {
    await this.checkoutButton.click();
  }

  async clickCancelButton() {
    await this.cancelButton.click();
  }
}

class CheckoutStepOnePage {
  readonly page: Page;

  // Placeholder selectors
  readonly firstNameInput = this.page.locator('[data-test="firstName"]');
  readonly lastNameInput = this.page.locator('[data-test="lastName"]');
  readonly postalCodeInput = this.page.locator('[data-test="postalCode"]');
  readonly continueButton = this.page.locator('[data-test="continue"]');
  readonly firstNameError = this.page.locator('[data-test="firstName"] + [class="error-message-container"]'); // Assuming error message is sibling

  constructor(page: Page) {
    this.page = page;
  }

  async waitForFirstNameInputVisible() {
    await expect(this.firstNameInput).toBeVisible();
  }

  async fillCustomerInformation(firstName: string, lastName: string, postalCode: string) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.postalCodeInput.fill(postalCode);
  }

  async clickContinueButton() {
    await this.continueButton.click();
  }

  async assertFirstNameErrorVisible() {
    await expect(this.firstNameError).toBeVisible();
  }

  async assertFirstNameErrorText(text: string) {
    await expect(this.firstNameError).toHaveText(text);
  }
}

class CheckoutStepTwoPage {
  readonly page: Page;

  // Placeholder selectors
  readonly summaryTotalLabel = this.page.locator('[class="summary_total_label"]');
  readonly finishButton = this.page.locator('[data-test="finish"]');

  constructor(page: Page) {
    this.page = page;
  }

  async waitForSummaryTotalLabelVisible() {
    await expect(this.summaryTotalLabel).toBeVisible();
  }

  async clickFinishButton() {
    await this.finishButton.click();
  }
}

class CheckoutCompletePage {
  readonly page: Page;

  // Placeholder selectors
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

  // Placeholder selectors
  readonly burgerMenuButton = this.page.locator('[id="react-burger-menu-btn"]');
  readonly logoutSidebarLink = this.page.locator('[id="logout_sidebar_link"]');

  constructor(page: Page) {
    this.page = page;
  }

  async clickBurgerMenuButton() {
    await this.burgerMenuButton.click();
  }

  async clickLogoutLink() {
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

    // 2. Fill username
    // 3. Fill password
    // 4. Click login button
    await loginPage.login('standard_user', 'secret_sauce');

    // 5. Wait for inventory list to be visible
    await inventoryPage.waitForInventoryListVisible();

    // 6. Click add to cart for backpack
    await inventoryPage.clickAddToCartBackpack();

    // 7. Assert cart badge has text "1"
    await inventoryPage.assertShoppingCartBadgeText('1');

    // 8. Click shopping cart link
    await inventoryPage.clickShoppingCartLink();

    // 9. Wait for cart item to be visible
    await cartPage.waitForCartItemVisible();

    // 10. Click checkout button
    await cartPage.clickCheckoutButton();

    // 11. Wait for first name input to be visible
    await checkoutStepOnePage.waitForFirstNameInputVisible();

    // 12. Fill first name
    // 13. Fill last name
    // 14. Fill postal code
    await checkoutStepOnePage.fillCustomerInformation('John', 'Doe', '12345');

    // 15. Click continue button
    await checkoutStepOnePage.clickContinueButton();

    // 16. Wait for summary total label to be visible
    await checkoutStepTwoPage.waitForSummaryTotalLabelVisible();

    // 17. Click finish button
    await checkoutStepTwoPage.clickFinishButton();

    // Expected Result: The user is redirected to the Order Confirmation page and the success message "Thank you for your order!" is displayed. The cart badge is no longer visible.
    await checkoutCompletePage.assertSuccessMessageVisible();
    await checkoutCompletePage.assertSuccessMessageText('Thank you for your order!');
    await inventoryPage.assertShoppingCartBadgeNotVisible();
  });

  test('Login attempt with locked_out_user credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill username
    // 3. Fill password
    // 4. Click login button
    await loginPage.login('locked_out_user', 'secret_sauce');

    // Expected Result: An error message "Epic sadface: Sorry, this user has been locked out." is displayed below the login form.
    await loginPage.assertErrorMessageVisible();
    await loginPage.assertErrorMessageText('Epic sadface: Sorry, this user has been locked out.');
  });

  test('Login attempt with invalid username and valid password', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill username
    // 3. Fill password
    // 4. Click login button
    await loginPage.login('invalid_user', 'secret_sauce');

    // Expected Result: An error message "Epic sadface: Username and password do not match any user in this service." is displayed below the login form.
    await loginPage.assertErrorMessageVisible();
    await loginPage.assertErrorMessageText('Epic sadface: Username and password do not match any user in this service.');
  });

  test('Login attempt with empty username and valid password', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill username with empty string
    // 3. Fill password
    // 4. Click login button
    await loginPage.login('', 'secret_sauce');

    // Expected Result: An error message "Epic sadface: Username is required" is displayed below the login form.
    await loginPage.assertErrorMessageVisible();
    await loginPage.assertErrorMessageText('Epic sadface: Username is required');
  });

  test('Login attempt with valid username and empty password', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill username
    // 3. Fill password with empty string
    // 4. Click login button
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

    // 2. Assert username input is visible
    // 3. Assert password input is visible
    // 4. Assert login button is visible
    await loginPage.assertUsernameInputVisible();
    await loginPage.assertPasswordInputVisible();
    await loginPage.assertLoginButtonVisible();

    // Expected Result: The username input field, password input field, and login button are all visible on the page.
  });

  test('Browse and add multiple items to the cart', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill username
    // 3. Fill password
    // 4. Click login button
    await loginPage.login('standard_user', 'secret_sauce');

    // 5. Wait for inventory list to be visible
    await inventoryPage.waitForInventoryListVisible();

    // 6. Click add to cart for backpack
    await inventoryPage.clickAddToCartBackpack();

    // 7. Click add to cart for bike light
    await inventoryPage.clickAddToCartBikeLight();

    // 8. Click add to cart for bolt t-shirt
    await inventoryPage.clickAddToCartBoltTShirt();

    // Expected Result: The cart badge displays '3'. The 'Add to Cart' buttons for the backpack, bike light, and bolt t-shirt have changed to 'Remove'.
    await inventoryPage.assertShoppingCartBadgeText('3');
    await expect(inventoryPage.addToCartBackpack).not.toBeVisible(); // Assuming it changes to Remove, which is not directly selectable by data-test="add-to-cart-..."
    await expect(inventoryPage.addToCartBikeLight).not.toBeVisible();
    await expect(inventoryPage.addToCartBoltTShirt).not.toBeVisible();
  });

  test('Sort products by Price (Low to High)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill username
    // 3. Fill password
    // 4. Click login button
    await loginPage.login('standard_user', 'secret_sauce');

    // 5. Wait for inventory list to be visible
    await inventoryPage.waitForInventoryListVisible();

    // 6. Select option "Price (Low to High)"
    await inventoryPage.selectSortOption('Price (Low to High)');

    // Expected Result: The product list is reordered with the lowest priced items appearing first. The first product displayed is 'Sauce Labs Onesie' ($7.99).
    const firstProduct = page.locator('.inventory_item').first();
    await expect(firstProduct.locator('.inventory_item_name')).toHaveText('Sauce Labs Onesie');
    await expect(firstProduct.locator('.inventory_item_price')).toHaveText('$7.99');
  });

  test('Sort products by Name (Z-A)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    // 1. Navigate to https://www.saucedemo.com/
    await loginPage.goto();

    // 2. Fill username
    // 3. Fill password
    // 4. Click login button
    await loginPage.login('standard_user', 'secret_sauce');

    // 5. Wait for inventory list to be visible
    await inventoryPage.waitForInventoryListVisible();

    // 6. Select option "Name (Z to A)"
    await inventoryPage.selectSortOption('Name (Z to A)');

    // Expected Result: The product list is reordered with product names in reverse alphabetical order. The first product displayed is 'Sauce Labs Zub Zub' (if such a product existed, otherwise the last alphabetically).
    const firstProduct = page.locator('.inventory_item').first();
    await expect(firstProduct.locator('.inventory_