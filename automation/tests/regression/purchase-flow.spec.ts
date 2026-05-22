import { test } from '../../fixtures/standard-fixtures';
import { parseCsv } from '../../utils/csv-parser';

const loginRecords = parseCsv<{ username: string; password: string; expectedResult: string }>(
  '../data/login-data.csv'
);
const validUser = loginRecords.find((record) => record.expectedResult === 'success');

if (!validUser) {
  throw new Error('Expected at least one successful login record in login-data.csv');
}

const checkoutRecords = parseCsv<{ firstName: string; lastName: string; postalCode: string; expectedMessage: string }>(
  '../data/checkout-data.csv'
);

test.describe('SauceDemo Regression', () => {
  for (const record of checkoutRecords) {
    test(`complete purchase as ${record.firstName} ${record.lastName}`, async ({ loginPage, inventoryPage, cartPage, checkoutPage }) => {
      await loginPage.goto();
      await loginPage.login(validUser.username, validUser.password);
      await inventoryPage.expectLoggedIn();

      const itemName = await inventoryPage.addFirstItemToCart();
      await inventoryPage.expectCartCount(1);

      await inventoryPage.openCart();
      await cartPage.expectItemInCart(itemName);
      await cartPage.checkout();

      await checkoutPage.fillCheckoutInformation(record.firstName, record.lastName, record.postalCode);
      await checkoutPage.finishCheckout();
      await checkoutPage.expectOrderComplete(record.expectedMessage);
    });
  }
});
