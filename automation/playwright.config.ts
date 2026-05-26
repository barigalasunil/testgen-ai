import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const reportDir = process.env.PW_REPORT_DIR
    ? path.resolve(process.env.PW_REPORT_DIR)
    : path.resolve('./public/automation-reports');

const isHeaded = process.env.PW_HEADED === 'true';

export default defineConfig({
    testDir: './tests',
    outputDir: './reports',
    reporter: [
        ['list'],
        ['html', { outputFolder: reportDir, open: 'never' }],
    ],
    retries: 0,
    workers: 1,
    fullyParallel: false,
    use: {
        baseURL: process.env.SAUCEDEMO_BASE_URL || 'https://www.saucedemo.com',
        headless: !isHeaded,
        viewport: { width: 1280, height: 720 },
        screenshot: 'only-on-failure',
        video: isHeaded ? 'on' : 'retain-on-failure',
        trace: 'retain-on-failure',
        actionTimeout: 15000,
        navigationTimeout: 30000,
        ...(isHeaded && { launchOptions: { slowMo: 800 } }),
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                headless: !isHeaded,
                ...(isHeaded && {
                    launchOptions: {
                        slowMo: 500,
                        args: ['--start-maximized', '--disable-infobars'],
                    },
                }),
            },
        },
    ],
});
