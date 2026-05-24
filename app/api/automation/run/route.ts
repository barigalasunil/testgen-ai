import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const VALID_SUITES = ['smoke', 'sanity', 'regression'] as const;
type SuiteName = (typeof VALID_SUITES)[number];

// Maps suite name to the grep tag used in test titles
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

async function runPlaywrightSuite(suite: SuiteName) {
    const rootDir = getProjectRoot();
    const reportDir = join(rootDir, 'public', 'automation-reports', suite);
    const automationDir = join(rootDir, 'automation');
    const configPath = join(automationDir, 'playwright.config.ts');

    console.log('[AUTOMATION] Suite:', suite);
    console.log('[AUTOMATION] Root:', rootDir);
    console.log('[AUTOMATION] Automation dir:', automationDir);
    console.log('[AUTOMATION] Config:', configPath);
    console.log('[AUTOMATION] Report dir:', reportDir);

    if (!existsSync(reportDir)) {
        mkdirSync(reportDir, { recursive: true });
    }

    // ── KEY FIX: use --grep against the describe block name ──
    // instead of passing a Windows path as a test filter.
    // Each spec file has test.describe('SauceDemo Smoke', ...) etc.
    const grepPattern = SUITE_GREP[suite];

    const args = [
        'playwright',
        'test',
        '--config', configPath,
        '--grep', grepPattern,
    ];

    console.log('[AUTOMATION] Command: npx', args.join(' '));

    return new Promise<{
        success: boolean;
        output: string;
        durationMs: number;
        stderr?: string;
    }>((resolvePromise, reject) => {
        const start = Date.now();
        const isWindows = process.platform === 'win32';

        const child = spawn('npx', args, {
            // ── Run from the automation folder so relative paths work ──
            cwd: automationDir,
            shell: isWindows,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                SAUCEDEMO_BASE_URL: 'https://www.saucedemo.com',
                PW_REPORT_DIR: reportDir,
            },
        });

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
        const suite = body?.suite as string;

        if (!VALID_SUITES.includes(suite as SuiteName)) {
            return NextResponse.json(
                { error: true, message: 'Invalid suite. Expected smoke, sanity, or regression.' },
                { status: 400 }
            );
        }

        const startedAt = new Date().toISOString();
        const reportUrl = getReportUrl(suite as SuiteName);

        const result = await runPlaywrightSuite(suite as SuiteName);

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