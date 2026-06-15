# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic\smoke.spec.ts >> Generic Custom URL Smoke >> page loads successfully with title, body, and non-5xx response
- Location: tests\generic\smoke.spec.ts:12:7

# Error details

```
TimeoutError: page.goto: Timeout 45000ms exceeded.
Call log:
  - navigating to "https://www.myvi.in/", waiting until "commit"

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
> 8  |   const response = await page.goto(getTargetUrl(), { waitUntil: 'commit', timeout: 45000 });
     |                               ^ TimeoutError: page.goto: Timeout 45000ms exceeded.
  9  |   await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => undefined);
  10 |   await page.waitForLoadState('load', { timeout: 15000 }).catch(() => undefined);
  11 |   return response;
  12 | }
  13 | 
  14 | export async function expectSuccessfulDocumentResponse(response: Response | null) {
  15 |   expect(response, 'Initial navigation should return a document response').not.toBeNull();
  16 |   expect(response?.status(), 'Target URL should not return a server error').toBeLessThan(500);
  17 | }
  18 | 
  19 | export async function expectPageHasContent(page: Page) {
  20 |   await expect(page.locator('body')).toBeVisible();
  21 |   await expect(page).toHaveTitle(/.+/);
  22 |   const visibleText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  23 |   const visibleMedia = await page.locator('img:visible, svg:visible, canvas:visible, video:visible').count();
  24 |   expect(visibleText.trim().length + visibleMedia, 'Page should not be blank').toBeGreaterThan(0);
  25 | }
  26 | 
  27 | export async function capturePageScreenshot(page: Page, testInfo: TestInfo, name: string) {
  28 |   const screenshot = await page.screenshot({ fullPage: true });
  29 |   await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
  30 | }
  31 | 
  32 | export function collectCriticalConsoleErrors(page: Page) {
  33 |   const criticalErrors: string[] = [];
  34 |   page.on('console', (message) => {
  35 |     if (message.type() !== 'error') return;
  36 |     const text = message.text();
  37 |     if (/(uncaught|typeerror|referenceerror|syntaxerror|is not defined|status of 5\d\d)/i.test(text)) {
  38 |       criticalErrors.push(text);
  39 |     }
  40 |   });
  41 |   page.on('pageerror', (error) => criticalErrors.push(error.message));
  42 |   return criticalErrors;
  43 | }
  44 | 
  45 | export async function expectCommonLandmarksIfPresent(page: Page) {
  46 |   const landmarks = page.locator('header, nav, main, footer, [role="banner"], [role="navigation"], [role="main"], [role="contentinfo"]');
  47 |   const count = await landmarks.count();
  48 |   for (let index = 0; index < Math.min(count, 6); index += 1) {
  49 |     await expect(landmarks.nth(index)).toBeVisible();
  50 |   }
  51 | }
  52 | 
  53 | export async function expectMajorLinksAreUsable(page: Page) {
  54 |   const links = page.locator('a[href]:visible');
  55 |   const count = await links.count();
  56 |   for (let index = 0; index < Math.min(count, 20); index += 1) {
  57 |     const link = links.nth(index);
  58 |     const href = (await link.getAttribute('href'))?.trim() || '';
  59 |     expect(href, `Visible link ${index + 1} should have an href`).not.toBe('');
  60 |     expect(href, `Visible link ${index + 1} should not use a javascript pseudo-link`).not.toMatch(/^javascript:/i);
  61 |   }
  62 | }
  63 | 
  64 | export async function expectInteractiveElementsAreVisible(page: Page) {
  65 |   const controls = page.locator('button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])');
  66 |   const count = await controls.count();
  67 |   expect(count, 'Page should expose at least one visible interactive element').toBeGreaterThan(0);
  68 | 
  69 |   let visibleControls = 0;
  70 |   for (let index = 0; index < Math.min(count, 30); index += 1) {
  71 |     const control = controls.nth(index);
  72 |     if (await control.isVisible().catch(() => false)) {
  73 |       visibleControls += 1;
  74 |     }
  75 |   }
  76 |   expect(visibleControls, 'Interactive elements should be visible').toBeGreaterThan(0);
  77 | }
  78 | 
```