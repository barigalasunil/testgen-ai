import { defineConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const reportDir = process.env.PW_REPORT_DIR
    ? path.resolve(process.env.PW_REPORT_DIR)
    : path.resolve('./public/automation-reports');
const allureResultsDir = process.env.ALLURE_RESULTS_DIR
    ? path.resolve(process.env.ALLURE_RESULTS_DIR)
    : path.resolve('./reports/allure-results');
const outputDir = process.env.PW_OUTPUT_DIR
    ? path.resolve(process.env.PW_OUTPUT_DIR)
    : path.resolve('./reports');

const isHeaded = process.env.PW_HEADED === 'true';
const browserName = process.env.PW_BROWSER || 'chromium';

// Find Chrome on Windows — use real Chrome for headed mode to avoid CMD flash
const WIN_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chromeExe = isHeaded && process.platform === 'win32' && fs.existsSync(WIN_CHROME)
    ? WIN_CHROME
    : undefined;

export default defineConfig({
    testDir: './tests',
    outputDir,
    reporter: [
        ['list'],
        ['html', { outputFolder: reportDir, open: 'never' }],
        ['allure-playwright', { resultsDir: allureResultsDir }],
    ],
    retries: 1,
    workers: 1,
    fullyParallel: false,
    use: {
        baseURL: process.env.SAUCEDEMO_BASE_URL || 'https://www.saucedemo.com',
        ignoreHTTPSErrors: false,
        headless: !isHeaded,
        viewport: { width: 1280, height: 720 },
        testIdAttribute: 'data-test',
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
        ...(browserName === 'all' || browserName === 'firefox'
            ? [{ name: 'firefox', use: { headless: !isHeaded } }]
            : []),
        ...(browserName === 'all' || browserName === 'webkit'
            ? [{ name: 'webkit', use: { headless: !isHeaded } }]
            : []),
    ],
});
