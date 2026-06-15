import { test } from '@playwright/test';
import {
  applyGenericAllureMetadata,
  capturePageScreenshot,
  expectPageHasContent,
  expectSuccessfulDocumentResponse,
  openTarget,
} from './generic-website.helpers';

test.describe('Generic Custom URL Smoke', () => {
  test.setTimeout(210000);

  test('Generic Custom URL Smoke - Page loads successfully', async ({ page }, testInfo) => {
    await applyGenericAllureMetadata(testInfo, {
      storyName: 'Custom URL Smoke',
      severityName: 'critical',
      tagNames: ['smoke', 'generic', 'custom-url'],
    });
    const response = await openTarget(page);

    await expectSuccessfulDocumentResponse(response);
    await expectPageHasContent(page);
    await capturePageScreenshot(page, testInfo, 'generic-smoke-page');
  });
});
