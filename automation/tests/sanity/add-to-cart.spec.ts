import { test, expect } from '../../fixtures/standard-fixtures';
import { parseCsv } from '../../utils/csv-parser';

const loginRecords = parseCsv<{ username: string; password: string; expectedResult: string }>(
  'login-data.csv'
);
const validUser = loginRecords.find((record) => record.expectedResult === 'success');

if (!validUser) {
  throw new Error('Expected at least one successful login record in login-data.csv');
}

test.describe('SauceDemo Sanity', () => {
  test('login and add first inventory item to cart', async ({ loginPage, inventoryPage, cartPage }) => {
    await loginPage.goto();
    await loginPage.login(validUser.username, validUser.password);
    await inventoryPage.expectLoggedIn();

    const itemName = await inventoryPage.addFirstItemToCart();
    await inventoryPage.expectCartCount(1);

    await inventoryPage.openCart();
    await cartPage.expectItemInCart(itemName);
  });
});
