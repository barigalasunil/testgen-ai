import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const reportDir = process.env.PW_REPORT_DIR
  ? path.resolve(process.env.PW_REPORT_DIR)
  : path.resolve('./public/automation-reports');

// HEADED env var set by run/route.ts for demo mode
const isHeaded = process.env.PW_HEADED === 'true';

export default defineConfig({
  testDir: './tests',
  outputDir: './reports',
  reporter: [
    ['list'],
    ['html', { outputFolder: reportDir, open: 'never' }],
  ],
  retries: process.env.CI ? 2 : 0,
  workers: 1, // single worker so browser is visible and sequential
  fullyParallel: false,
  use: {
    baseURL: process.env.SAUCEDEMO_BASE_URL || 'https://www.saucedemo.com',
    headless: !isHeaded, // false = browser opens visibly
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: isHeaded ? 'on' : 'retain-on-failure', // record full video in headed
    trace: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 20000,
    slowMo: isHeaded ? 500 : 0, // slow down 500ms so demo is watchable
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Explicitly set headless here so it overrides devices spread
        headless: !isHeaded,
        launchOptions: {
          headless: !isHeaded,
          slowMo: isHeaded ? 800 : 0,
          args: isHeaded ? ['--start-maximized'] : [],
        },
      },
    },
  ],
});