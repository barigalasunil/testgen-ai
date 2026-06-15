import { expect, test } from '@playwright/test';
import {
  applyGenericAllureMetadata,
  capturePageScreenshot,
  collectCriticalConsoleErrors,
  expectCommonLandmarksIfPresent,
  expectInteractiveElementsAreVisible,
  expectMajorLinksAreUsable,
  expectPageHasContent,
  expectSuccessfulDocumentResponse,
  getTargetUrl,
  openTarget,
} from './generic-website.helpers';

test.describe('Generic Custom URL Regression', () => {
  test.setTimeout(300000);

  test('Generic Custom URL Regression - Core links and interactions', async ({ page, context }, testInfo) => {
    await applyGenericAllureMetadata(testInfo, {
      storyName: 'Custom URL Regression',
      severityName: 'normal',
      tagNames: ['regression', 'generic', 'custom-url', 'links', 'interactions'],
    });
    const criticalConsoleErrors = collectCriticalConsoleErrors(page);
    const response = await openTarget(page);

    await expectSuccessfulDocumentResponse(response);
    await expectPageHasContent(page);
    await expectCommonLandmarksIfPresent(page);
    await expectMajorLinksAreUsable(page);
    await expectInteractiveElementsAreVisible(page);

    const targetOrigin = new URL(getTargetUrl()).origin;
    const sameOriginLinks = page.locator('a[href]:visible').filter({ hasNotText: /logout|delete|remove|checkout|purchase/i });
    const linksToCheck: string[] = [];
    const linkCount = await sameOriginLinks.count();
    for (let index = 0; index < linkCount && linksToCheck.length < 3; index += 1) {
      const href = await sameOriginLinks.nth(index).getAttribute('href');
      if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
      const resolved = new URL(href, page.url()).toString();
      if (new URL(resolved).origin === targetOrigin) linksToCheck.push(resolved);
    }

    for (const href of linksToCheck) {
      const checkPage = await context.newPage();
      const linkResponse = await checkPage.goto(href, { waitUntil: 'domcontentloaded' });
      expect(linkResponse?.status() || 0, `Safe same-origin link should not return 5xx: ${href}`).toBeLessThan(500);
      await checkPage.close();
    }

    await capturePageScreenshot(page, testInfo, 'generic-regression-page');
    expect(criticalConsoleErrors, 'No uncaught critical console errors should occur during generic regression').toEqual([]);
  });
});
