import { test, expect } from '@playwright/test';

test('healable assertion mismatch local probe', async ({ page }) => {
  await page.setContent('<main><div class="login_logo">Swag Labs</div></main>');
  await expect(page.locator('.login_logo')).toHaveText('swag labs');
});