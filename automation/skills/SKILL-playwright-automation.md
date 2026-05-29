# SKILL: Playwright Automation Script Generation

## Purpose
Generate production-quality Playwright TypeScript test scripts using
Page Object Model for SauceDemo and any web application.

## When to use this skill
- User asks to automate a test scenario
- Agent step 4 needs to generate scripts from a test plan
- Agent step 5 needs to heal a failing script

## Project Structure
```
automation/
├── playwright.config.ts
├── tests/smoke/          — @smoke tag, critical path
├── tests/sanity/         — @sanity tag, core flows
├── tests/regression/     — @regression tag, full coverage
├── pages/                — Page Object Model classes
├── data/                 — CSV files: login-data.csv, checkout-data.csv
├── fixtures/standard-fixtures.ts
└── utils/csv-parser.ts
```

## SauceDemo Selectors — Use Exactly As Written
```typescript
// Login
page.locator('#user-name')
page.locator('#password')
page.locator('#login-button')
page.locator('[data-test="error"]')

// Inventory
page.locator('.inventory_list')
page.locator('.inventory_item')
page.locator('.inventory_item_name')
page.locator('.inventory_item_price')
page.locator('.shopping_cart_badge')
page.locator('.shopping_cart_link')

// Cart
page.locator('.cart_item')
page.locator('[data-test="checkout"]')

// Checkout
page.locator('[data-test="firstName"]')
page.locator('[data-test="lastName"]')
page.locator('[data-test="postalCode"]')
page.locator('[data-test="continue"]')
page.locator('[data-test="finish"]')
page.locator('.complete-header')
```

## Script Template
```typescript
import { test, expect } from '../fixtures/standard-fixtures';
import { parseCsv } from '../utils/csv-parser';

test.describe('SauceDemo [Suite Name]', () => {
test('TC-001: Test title matching test plan', async ({ loginPage, inventoryPage }) => {
await loginPage.goto();
await loginPage.login('standard_user', 'secret_sauce');
await inventoryPage.expectLoggedIn();
});
});
```

## Data-Driven Template
```typescript
const records = parseCsv(
'login-data.csv'
);

for (const record of records) {
test(`Login as ${record.username} expects ${record.expectedResult}`,
async ({ loginPage }) => {
await loginPage.goto();
await loginPage.login(record.username, record.password);
if (record.expectedResult === 'success') {
await loginPage.expectLoggedIn();
} else {
await expect(loginPage.errorMessage).toContainText('Epic sadface');
}
}
);
}
```

## Suite Naming for Grep
- `test.describe('SauceDemo Smoke', ...)` — runs with `--grep "SauceDemo Smoke"`
- `test.describe('SauceDemo Sanity', ...)` — runs with `--grep "SauceDemo Sanity"`
- `test.describe('SauceDemo Regression', ...)` — runs with `--grep "SauceDemo Regression"`

## Anti-Hallucination Rules
- Only use selectors confirmed to exist on the target page
- Never assert text that hasn't been verified on the actual application
- Exact confirmation message: "Thank you for your order!"
- CSV path: filename only, no directory prefix — `parseCsv('login-data.csv')`