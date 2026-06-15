import { expect, test } from '@playwright/test';
import {
  applyGenericAllureMetadata,
  capturePageScreenshot,
  collectCriticalConsoleErrors,
  expectCommonLandmarksIfPresent,
  expectMajorLinksAreUsable,
  expectPageHasContent,
  expectSuccessfulDocumentResponse,
  openTarget,
} from './generic-website.helpers';

test.describe('Generic Custom URL Sanity', () => {
  test.setTimeout(240000);

  test('Generic Custom URL Sanity - Page structure and console validation', async ({ page }, testInfo) => {
    await applyGenericAllureMetadata(testInfo, {
      storyName: 'Custom URL Sanity',
      severityName: 'normal',
      tagNames: ['sanity', 'generic', 'custom-url', 'console'],
    });
    const criticalConsoleErrors = collectCriticalConsoleErrors(page);
    const response = await openTarget(page);

    await expectSuccessfulDocumentResponse(response);
    await expectPageHasContent(page);
    await expectCommonLandmarksIfPresent(page);
    await expectMajorLinksAreUsable(page);
    await capturePageScreenshot(page, testInfo, 'generic-sanity-page');

    expect(criticalConsoleErrors, 'No uncaught critical console errors should occur during initial load').toEqual([]);
  });
});
