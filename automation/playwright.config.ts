import { defineConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const reportDir = process.env.PW_REPORT_DIR
    ? path.resolve(process.env.PW_REPORT_DIR)
    : path.resolve('./public/automation-reports');

const isHeaded = process.env.PW_HEADED === 'true';

// Find Chrome on Windows — use real Chrome for headed mode to avoid CMD flash
const WIN_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chromeExe = isHeaded && process.platform === 'win32' && fs.existsSync(WIN_CHROME)
    ? WIN_CHROME
    : undefined;

export default defineConfig({
    testDir: './tests',
    outputDir: './reports',
    reporter: [
        ['list'],
        ['html', { outputFolder: reportDir, open: 'never' }],
    ],
    retries: 1,
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
    },
    projects: [
        {
            name: 'chromium',
            use: {
                headless: !isHeaded,
                launchOptions: {
                    headless: !isHeaded,
                    slowMo: isHeaded ? 800 : 0,
                    executablePath: chromeExe,
                    args: isHeaded
                        ? ['--start-maximized', '--disable-infobars', '--no-sandbox']
                        : [],
                },
            },
        },
    ],
});
