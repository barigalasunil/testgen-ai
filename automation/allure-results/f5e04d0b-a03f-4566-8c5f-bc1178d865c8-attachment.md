# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic\smoke.spec.ts >> Generic Custom URL Smoke >> page loads successfully with title, body, and non-5xx response
- Location: tests\generic\smoke.spec.ts:10:7

# Error details

```
Error: page.goto: net::ERR_NETWORK_ACCESS_DENIED at https://www.myvi.in/
Call log:
  - navigating to "https://www.myvi.in/", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { expect, type Page, type Response, type TestInfo } from '@playwright/test';
  2  | 
  3  | export function getTargetUrl() {
  4  |   return process.env.TARGET_URL || process.env.SAUCEDEMO_BASE_URL || 'https://www.saucedemo.com';
  5  | }
  6  | 
  7  | export async function openTarget(page: Page) {
> 8  |   const response = await page.goto(getTargetUrl(), { waitUntil: 'domcontentloaded' });
     |                               ^ Error: page.goto: net::ERR_NETWORK_ACCESS_DENIED at https://www.myvi.in/
  9  |   await page.waitForLoadState('load', { timeout: 30000 }).catch(() => undefined);
  10 |   return response;
  11 | }
  12 | 
  13 | export async function expectSuccessfulDocumentResponse(response: Response | null) {
  14 |   expect(response, 'Initial navigation should return a document response').not.toBeNull();
  15 |   expect(response?.status(), 'Target URL should not return a server error').toBeLessThan(500);
  16 | }
  17 | 
  18 | export async function expectPageHasContent(page: Page) {
  19 |   await expect(page.locator('body')).toBeVisible();
  20 |   await expect(page).toHaveTitle(/.+/);
  21 |   const visibleText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  22 |   const visibleMedia = await page.locator('img:visible, svg:visible, canvas:visible, video:visible').count();
  23 |   expect(visibleText.trim().length + visibleMedia, 'Page should not be blank').toBeGreaterThan(0);
  24 | }
  25 | 
  26 | export async function capturePageScreenshot(page: Page, testInfo: TestInfo, name: string) {
  27 |   const screenshot = await page.screenshot({ fullPage: true });
  28 |   await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
  29 | }
  30 | 
  31 | export function collectCriticalConsoleErrors(page: Page) {
  32 |   const criticalErrors: string[] = [];
  33 |   page.on('console', (message) => {
  34 |     if (message.type() !== 'error') return;
  35 |     const text = message.text();
  36 |     if (/(uncaught|typeerror|referenceerror|syntaxerror|is not defined|status of 5\d\d)/i.test(text)) {
  37 |       criticalErrors.push(text);
  38 |     }
  39 |   });
  40 |   page.on('pageerror', (error) => criticalErrors.push(error.message));
  41 |   return criticalErrors;
  42 | }
  43 | 
  44 | export async function expectCommonLandmarksIfPresent(page: Page) {
  45 |   const landmarks = page.locator('header, nav, main, footer, [role="banner"], [role="navigation"], [role="main"], [role="contentinfo"]');
  46 |   const count = await landmarks.count();
  47 |   for (let index = 0; index < Math.min(count, 6); index += 1) {
  48 |     await expect(landmarks.nth(index)).toBeVisible();
  49 |   }
  50 | }
  51 | 
  52 | export async function expectMajorLinksAreUsable(page: Page) {
  53 |   const links = page.locator('a[href]:visible');
  54 |   const count = await links.count();
  55 |   for (let index = 0; index < Math.min(count, 20); index += 1) {
  56 |     const link = links.nth(index);
  57 |     const href = (await link.getAttribute('href'))?.trim() || '';
  58 |     expect(href, `Visible link ${index + 1} should have an href`).not.toBe('');
  59 |     expect(href, `Visible link ${index + 1} should not use a javascript pseudo-link`).not.toMatch(/^javascript:/i);
  60 |   }
  61 | }
  62 | 
  63 | export async function expectInteractiveElementsAreVisible(page: Page) {
  64 |   const controls = page.locator('button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])');
  65 |   const count = await controls.count();
  66 |   expect(count, 'Page should expose at least one visible interactive element').toBeGreaterThan(0);
  67 | 
  68 |   let visibleControls = 0;
  69 |   for (let index = 0; index < Math.min(count, 30); index += 1) {
  70 |     const control = controls.nth(index);
  71 |     if (await control.isVisible().catch(() => false)) {
  72 |       visibleControls += 1;
  73 |     }
  74 |   }
  75 |   expect(visibleControls, 'Interactive elements should be visible').toBeGreaterThan(0);
  76 | }
  77 | 
```