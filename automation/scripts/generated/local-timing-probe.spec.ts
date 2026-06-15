import { test, expect } from '@playwright/test';

test('healable timing local probe', async ({ page }) => {
  await page.setContent('<div id="root"></div>');
  await page.evaluate(() => {
    setTimeout(() => {
      document.querySelector('#root')!.innerHTML = '<span id="ready">Ready</span>';
    }, 150);
  });
  await page.waitForTimeout(1);
  await expect(page.locator('#ready')).toBeVisible({ timeout: 5 });
});