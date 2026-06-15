import { expect, type Page, type Response, type TestInfo } from '@playwright/test';
import { feature, parameter, severity, story, suite, tags } from 'allure-js-commons';

export function getTargetUrl() {
  return process.env.TARGET_URL || process.env.SAUCEDEMO_BASE_URL || 'https://www.saucedemo.com';
}

type GenericMetadata = {
  storyName: string;
  severityName: 'normal' | 'critical';
  tagNames: string[];
};

export async function applyGenericAllureMetadata(testInfo: TestInfo, metadata: GenericMetadata) {
  const targetUrl = getTargetUrl();
  const runId = process.env.RUN_ID || 'local';

  testInfo.annotations.push(
    { type: 'suite', description: 'Automation Hub' },
    { type: 'feature', description: 'Generic Website Validation' },
    { type: 'story', description: metadata.storyName },
    { type: 'severity', description: metadata.severityName },
    { type: 'targetUrl', description: targetUrl },
    { type: 'runId', description: runId },
    ...metadata.tagNames.map(tagName => ({ type: 'tag', description: tagName }))
  );

  await suite('Automation Hub');
  await feature('Generic Website Validation');
  await story(metadata.storyName);
  await severity(metadata.severityName);
  await tags(...metadata.tagNames);
  await parameter('targetUrl', targetUrl);
  await parameter('runId', runId);
}

type NavigationAttempt = {
  waitUntil: 'domcontentloaded' | 'load' | 'commit';
  timeout: number;
};

const navigationAttempts: NavigationAttempt[] = [
  { waitUntil: 'domcontentloaded', timeout: 60000 },
  { waitUntil: 'load', timeout: 60000 },
  { waitUntil: 'commit', timeout: 60000 },
];

export async function openTarget(page: Page) {
  const targetUrl = getTargetUrl();
  const errors: string[] = [];

  for (let index = 0; index < navigationAttempts.length; index += 1) {
    const attempt = navigationAttempts[index];
    console.log(`Navigation attempt ${index + 1}: ${attempt.waitUntil}`);
    try {
      const response = await page.goto(targetUrl, attempt);
      console.log(`Navigation attempt ${index + 1} succeeded: ${attempt.waitUntil}`);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Attempt ${index + 1} (${attempt.waitUntil}): ${message}`);
      if (/timeout/i.test(message)) {
        console.log(`Navigation timeout after ${Math.round(attempt.timeout / 1000)}s`);
      } else {
        console.log(`Navigation attempt ${index + 1} failed: ${message}`);
      }
    }
  }

  await page.screenshot({ fullPage: true }).catch(() => undefined);
  throw new Error(`SITE_NAVIGATION_TIMEOUT\n${errors.join('\n')}`);
}

export async function expectSuccessfulDocumentResponse(response: Response | null) {
  expect(response, 'Initial navigation should return a document response').not.toBeNull();
  expect(response?.status(), 'Target URL should not return a server error').toBeLessThan(500);
}

export async function expectPageHasContent(page: Page) {
  await expect(page.locator('body')).toBeVisible();
  const title = await page.title().catch(() => '');
  if (!title.trim()) console.log('Page title is empty; using visible content assertions instead.');
  const visibleText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  const visibleMedia = await page.locator('img:visible, svg:visible, canvas:visible, video:visible').count();
  expect(visibleText.trim().length + visibleMedia, 'Page should not be blank').toBeGreaterThan(0);
}

export async function capturePageScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
}

export function collectCriticalConsoleErrors(page: Page) {
  const criticalErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/(uncaught|typeerror|referenceerror|syntaxerror|is not defined|status of 5\d\d)/i.test(text)) {
      criticalErrors.push(text);
    }
  });
  page.on('pageerror', (error) => criticalErrors.push(error.message));
  return criticalErrors;
}

export async function expectCommonLandmarksIfPresent(page: Page) {
  const landmarks = page.locator('header, nav, main, footer, [role="banner"], [role="navigation"], [role="main"], [role="contentinfo"]');
  const count = await landmarks.count();
  for (let index = 0; index < Math.min(count, 6); index += 1) {
    await expect(landmarks.nth(index)).toBeVisible();
  }
}

export async function expectMajorLinksAreUsable(page: Page) {
  const links = page.locator('a[href]:visible');
  const count = await links.count();
  for (let index = 0; index < Math.min(count, 20); index += 1) {
    const link = links.nth(index);
    const href = (await link.getAttribute('href'))?.trim() || '';
    expect(href, `Visible link ${index + 1} should have an href`).not.toBe('');
    expect(href, `Visible link ${index + 1} should not use a javascript pseudo-link`).not.toMatch(/^javascript:/i);
  }
}

export async function expectInteractiveElementsAreVisible(page: Page) {
  const controls = page.locator('button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])');
  const count = await controls.count();
  expect(count, 'Page should expose at least one visible interactive element').toBeGreaterThan(0);

  let visibleControls = 0;
  for (let index = 0; index < Math.min(count, 30); index += 1) {
    const control = controls.nth(index);
    if (await control.isVisible().catch(() => false)) {
      visibleControls += 1;
    }
  }
  expect(visibleControls, 'Interactive elements should be visible').toBeGreaterThan(0);
}
