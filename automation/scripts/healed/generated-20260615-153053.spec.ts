// Auto-healed by TCGen-Buddy.
// Run ID: generated-20260615-153053
// Failure Type: LOCATOR_NOT_FOUND
import { test, expect } from '@playwright/test';

test('healable assertion mismatch local probe', async ({ page }) => {
  await page.setContent('<main><div class="login_logo">Swag Labs</div></main>');
  await expect(page.locator('.login_logo:visible')).toHaveText('swag labs');
});