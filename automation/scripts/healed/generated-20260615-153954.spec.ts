// Auto-healed by TCGen-Buddy.
// Run ID: generated-20260615-153954
// Failure Type: TIMING_ISSUE
import { test, expect } from '@playwright/test';

test('healable timing local probe', async ({ page }) => {
  await page.setContent('<div id="root"></div><script>setTimeout(() => { document.querySelector("#root").innerHTML = "<span id=\"ready\">Ready</span>"; }, 150);</script>');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#ready')).toBeVisible({ timeout: 5000 });
});