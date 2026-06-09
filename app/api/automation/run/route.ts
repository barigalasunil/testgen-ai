import { NextResponse } from 'next/server';
import { execSync, spawn } from 'child_process';
import { join, basename } from 'path';
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync } from 'fs';
import os from 'os';

const VALID_SUITES = ['smoke', 'sanity', 'regression'] as const;
type SuiteName = (typeof VALID_SUITES)[number];

const SUITE_GREP: Record<SuiteName, string> = {
    smoke: 'SauceDemo Smoke',
    sanity: 'SauceDemo Sanity',
    regression: 'SauceDemo Regression',
};

type PlaywrightRunResult = {
    success: boolean;
    output: string;
    durationMs: number;
    stderr?: string;
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
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'npx.cmd' : 'npx';
    try {
        execSync(`${cmd} playwright --version`, { cwd: automationDir });
    } catch {
        throw new Error('Playwright is not installed. Run: npm install @playwright/test');
    }

    try {
        execSync(`${cmd} playwright test --list --config playwright.config.ts`, {
            cwd: automationDir,
            env: { ...process.env, PW_REPORT_DIR: os.tmpdir() },
        });
    } catch {
        throw new Error('Playwright browser binaries are missing. Run: npx playwright install chromium');
    }
}

function runPlaywright(args: string[], reportDir: string, headed: boolean): Promise<PlaywrightRunResult> {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');

    if (!existsSync(reportDir)) {
        mkdirSync(reportDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
        const start = Date.now();
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

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr?.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', (error) => {
            reject({ error, durationMs: Date.now() - start, stdout, stderr });
        });

        const timeoutHandle = setTimeout(() => {
            child.kill();
        }, 30 * 60 * 1000);

        child.on('close', (code) => {
            clearTimeout(timeoutHandle);
            resolve({
                success: code === 0,
                output: stdout,
                stderr,
                durationMs: Date.now() - start,
            });
        });
    });
}

async function runPlaywrightSuite(suite: SuiteName, headed: boolean): Promise<PlaywrightRunResult> {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const reportDir = join(rootDir, 'public', 'automation-reports', suite);
    const configPath = join(automationDir, 'playwright.config.ts');

    return runPlaywright([
        'playwright',
        'test',
        '--config',
        configPath,
        '--grep',
        SUITE_GREP[suite],
    ], reportDir, headed);
}

async function runGeneratedScript(scriptFile: string, headed: boolean, scriptCode?: string): Promise<PlaywrightRunResult> {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const configPath = join(automationDir, 'playwright.config.ts');
    const safeScriptFile = basename(scriptFile);
    const generatedDir = join(automationDir, 'scripts', 'generated');
    const scriptPath = join(generatedDir, safeScriptFile);
    const reportDir = join(rootDir, 'public', 'automation-reports', 'generated');

    if (scriptCode?.trim()) {
        if (!existsSync(generatedDir)) {
            mkdirSync(generatedDir, { recursive: true });
        }
        writeFileSync(scriptPath, scriptCode, 'utf-8');
    }

    if (!existsSync(scriptPath)) {
        throw new Error(`Generated script not found: ${scriptPath}`);
    }

    const tempTestFile = `_generated_${safeScriptFile}`;
    const testDir = join(automationDir, 'tests');
    const tempTestPath = join(testDir, tempTestFile);
    copyFileSync(scriptPath, tempTestPath);

    try {
        return await runPlaywright([
            'playwright',
            'test',
            tempTestFile,
            '--config',
            configPath,
        ], reportDir, headed);
    } finally {
        try {
            unlinkSync(tempTestPath);
        } catch {
            // Temporary generated spec may already be removed.
        }
    }
}

function summarizePlaywrightResult(result: PlaywrightRunResult) {
    const combinedOutput = `${result.output || ''}\n${result.stderr || ''}`;
    const passed: string[] = [];
    const failed: string[] = [];

    for (const line of combinedOutput.split('\n')) {
        const passMatch = line.match(/[✓√].*›\s(.+)/) || line.match(/\b(?:ok|passed)\b.*›\s(.+)/i);
        const failMatch = line.match(/[✘✕×x].*›\s(.+)/i) || line.match(/\bfailed\b.*›\s(.+)/i);
        if (passMatch) passed.push(passMatch[1].trim());
        if (failMatch) failed.push(failMatch[1].trim());
    }

    const totalFromOutput = [...combinedOutput.matchAll(/(\d+)\s+(passed|failed)/gi)]
        .reduce((total, match) => total + Number(match[1] || 0), 0);
    const total = passed.length + failed.length || totalFromOutput || (result.success ? 1 : 0);
    const failedCount = failed.length || (result.success ? 0 : Math.max(totalFromOutput, 1));
    const passedCount = passed.length || (result.success ? total : 0);

    return {
        total,
        passed: passedCount,
        failed: failedCount,
        passedTests: passed,
        failedTests: failed,
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const type = body?.type as string;
        const suite = body?.suite as string;
        const scriptFile = body?.scriptFile as string;
        const scriptCode = typeof body?.scriptCode === 'string' ? body.scriptCode : undefined;
        const headed = body?.headed === true;

        if (type === 'generated' && scriptFile) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    const addLog = (message: string) => {
                        controller.enqueue(encoder.encode(`${message}\n`));
                    };
                    const addResult = (data: object) => {
                        controller.enqueue(encoder.encode(`__RESULT__:${JSON.stringify(data)}\n`));
                    };

                    addLog('Launching automation execution...');
                    addLog(`Script: ${basename(scriptFile)}`);

                    try {
                        await validateEnvironment();
                        addLog('Running generated Playwright script...');
                        const result = await runGeneratedScript(scriptFile, headed, scriptCode);
                        const summary = summarizePlaywrightResult(result);
                        const reportUrl = '/automation-reports/generated/index.html';

                        addResult({
                            type: 'summary',
                            total: summary.total,
                            passed: summary.passed,
                            failed: summary.failed,
                            durationMs: result.durationMs,
                            reportUrl,
                        });

                        if (summary.passedTests.length > 0) {
                            addResult({ type: 'passed', tests: summary.passedTests });
                        }
                        if (summary.failedTests.length > 0) {
                            addResult({ type: 'failed', tests: summary.failedTests });
                        }

                        addLog(`Passed: ${summary.passed}`);
                        addLog(`Failed: ${summary.failed}`);
                        addLog(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
                        addLog(`Report: ${reportUrl}`);

                        if (result.output) {
                            result.output.split('\n').filter(Boolean).forEach(addLog);
                        }
                        if (result.stderr) {
                            result.stderr.split('\n').filter(Boolean).forEach(addLog);
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        addLog(`Execution error: ${message}`);
                        addResult({
                            type: 'summary',
                            total: 1,
                            passed: 0,
                            failed: 1,
                            durationMs: 0,
                            reportUrl: '/automation-reports/generated/index.html',
                        });
                    } finally {
                        controller.close();
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/plain',
                    'Transfer-Encoding': 'chunked',
                },
            });
        }

        if (type === 'restassured') {
            return NextResponse.json({ error: false, message: 'RestAssured tests must be executed via Maven.', status: 'skipped' });
        }
        if (type === 'scenarios' || type === 'manual') {
            return NextResponse.json({ error: false, message: 'These are manual test artifacts meant for human execution.', status: 'skipped' });
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
