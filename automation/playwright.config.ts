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
const isGenericCustomUrl = process.env.GENERIC_CUSTOM_URL === 'true';
const genericChromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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
        ignoreHTTPSErrors: isGenericCustomUrl,
        headless: !isHeaded,
        viewport: { width: 1280, height: 720 },
        userAgent: isGenericCustomUrl ? genericChromeUserAgent : undefined,
        locale: isGenericCustomUrl ? 'en-US' : undefined,
        extraHTTPHeaders: isGenericCustomUrl
            ? {
                'Accept-Language': 'en-US,en;q=0.9',
            }
            : undefined,
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
                        : isGenericCustomUrl
                            ? ['--disable-blink-features=AutomationControlled', '--ignore-certificate-errors']
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
