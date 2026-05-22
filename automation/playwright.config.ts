import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './reports',
  reporter: [
    ['list'],
    ['html', { outputFolder: './reports/html', open: 'never' }],
  ],
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  fullyParallel: true,
  use: {
    baseURL: process.env.SAUCEDEMO_BASE_URL || 'https://www.saucedemo.com',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 20000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
