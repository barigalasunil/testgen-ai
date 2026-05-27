import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const VALID_SUITES = ['smoke', 'sanity', 'regression'] as const;
type SuiteName = (typeof VALID_SUITES)[number];

const SUITE_GREP: Record<SuiteName, string> = {
    smoke: 'SauceDemo Smoke',
    sanity: 'SauceDemo Sanity',
    regression: 'SauceDemo Regression',
};

function getReportUrl(suite: SuiteName) {
    return `/automation-reports/${suite}/index.html`;
}

function getProjectRoot(): string {
    let root = process.cwd();
    if (root.includes('.next') || root.includes('dist')) {
        root = root.split('.next')[0].split('dist')[0];
    }
    return root;
}

async function validateEnvironment() {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    
    // Check if Playwright is installed
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'npx.cmd' : 'npx';
    const { execSync } = require('child_process');

    try {
        execSync(`${cmd} playwright --version`, { cwd: automationDir });
    } catch (e) {
        throw new Error('Playwright is not installed. Please run: npm install @playwright/test');
    }

    // Check for browser binaries (Chromium)
    try {
        // This command returns a non-zero exit code if browsers are missing
        execSync(`${cmd} playwright test --list --config playwright.config.ts`, { 
            cwd: automationDir,
            env: { ...process.env, PW_REPORT_DIR: '/tmp' } 
        });
    } catch (e) {
        throw new Error('Playwright browser binaries not installed. Please run: npx playwright install chromium');
    }
}

async function runPlaywrightSuite(suite: SuiteName, headed: boolean) {
    const rootDir = getProjectRoot();
    const reportDir = join(rootDir, 'public', 'automation-reports', suite);
    const automationDir = join(rootDir, 'automation');
    const configPath = join(automationDir, 'playwright.config.ts');

    console.log('[AUTOMATION] Suite:', suite, '| Headed:', headed);

    if (!existsSync(reportDir)) {
        mkdirSync(reportDir, { recursive: true });
    }

    const grepPattern = SUITE_GREP[suite];

    const args = [
        'playwright',
        'test',
        '--config', configPath,
        '--grep', grepPattern,
    ];

    return new Promise<{
        success: boolean;
        output: string;
        durationMs: number;
        stderr?: string;
    }>((resolvePromise, reject) => {
        const start = Date.now();
        const isWindows = process.platform === 'win32';

        const child = spawn('npx', args, {
            cwd: automationDir,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: false,
            detached: false,
            env: {
                ...process.env,
                SAUCEDEMO_BASE_URL: 'https://www.saucedemo.com',
                PW_REPORT_DIR: reportDir,
                PW_HEADED: headed ? 'true' : 'false',
                FORCE_COLOR: '0',
            },
        });

        if (isWindows) {
            child.unref();
        }

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk) => {
            const text = chunk.toString();
            stdout += text;
            console.log('[STDOUT]', text.trim());
        });

        child.stderr?.on('data', (chunk) => {
            const text = chunk.toString();
            stderr += text;
            console.error('[STDERR]', text.trim());
        });

        child.on('error', (error) => {
            reject({ error, durationMs: Date.now() - start, stdout, stderr });
        });

        const timeoutHandle = setTimeout(() => {
            console.error('[AUTOMATION] Timeout — killing process');
            child.kill();
        }, 30 * 60 * 1000);

        child.on('close', (code) => {
            clearTimeout(timeoutHandle);
            const durationMs = Date.now() - start;
            console.log('[AUTOMATION] Exit code:', code, 'Duration:', durationMs, 'ms');
            resolvePromise({
                success: code === 0,
                output: stdout,
                durationMs,
                stderr,
            });
        });
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const type = body?.type as string; // from testType
        const suite = body?.suite as string;
        // headed flag from dashboard toggle — default false
        const headed = body?.headed === true;

        if (type === 'restassured') {
            return NextResponse.json({ error: true, message: 'RestAssured tests must be executed via Maven.' }, { status: 405 });
        }
        if (type === 'scenarios' || type === 'manual') {
            return NextResponse.json({ error: true, message: 'These are manual test artifacts meant for human execution.' }, { status: 405 });
        }

        if (!suite || !VALID_SUITES.includes(suite as SuiteName)) {
            return NextResponse.json(
                { error: true, message: 'Invalid suite. Expected smoke, sanity, or regression.' },
                { status: 400 }
            );
        }

        await validateEnvironment();

        const startedAt = new Date().toISOString();
        const reportUrl = getReportUrl(suite as SuiteName);

        const result = await runPlaywrightSuite(suite as SuiteName, headed);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: true,
                    suite,
                    status: 'failed',
                    startedAt,
                    finishedAt: new Date().toISOString(),
                    durationMs: result.durationMs,
                    reportUrl,
                    message: 'Test execution failed.',
                    output: result.output,
                    stderr: result.stderr,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            error: false,
            suite,
            status: 'completed',
            startedAt,
            finishedAt: new Date().toISOString(),
            durationMs: result.durationMs,
            reportUrl,
            message: 'Execution succeeded.',
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[API ERROR]', msg);
        return NextResponse.json(
            { error: true, message: `Automation failed: ${msg}` },
            { status: 500 }
        );
    }
}