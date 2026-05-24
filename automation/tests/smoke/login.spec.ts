import { test, expect } from '../../fixtures/standard-fixtures';
import { parseCsv } from '../../utils/csv-parser';

const loginRecords = parseCsv<{ username: string; password: string; expectedResult: string }>(
  'login-data.csv'
);

test.describe('SauceDemo Smoke', () => {
  for (const record of loginRecords) {
    test(`login for ${record.username} should ${record.expectedResult}`, async ({ loginPage }) => {
      await loginPage.goto();
      await loginPage.login(record.username, record.password);

      if (record.expectedResult === 'success') {
        await loginPage.expectLoggedIn();
      } else {
        await expect(loginPage.errorMessage).toContainText('Epic sadface');
      }
    });
  }
});
