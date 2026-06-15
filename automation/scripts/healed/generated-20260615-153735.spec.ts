// Auto-healed by TCGen-Buddy.
// Run ID: generated-20260615-153735
// Failure Type: LOCATOR_NOT_FOUND
import { test, expect } from '@playwright/test';

test('healable timing local probe', async ({ page }) => {
  await page.setContent('<div id="root"></div><script>setTimeout(() => { document.querySelector("#root").innerHTML = "<span id=\"ready\">Ready</span>"; }, 150);</script>');
  await page.waitForTimeout(1);
  await expect(page.getByTestId('ready')).toBeVisible({ timeout: 5 });
});