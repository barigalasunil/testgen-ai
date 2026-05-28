import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { join, basename } from 'path';
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from 'fs';
import os from 'os';

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
            env: { ...process.env, PW_REPORT_DIR: os.tmpdir() } 
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

async function runGeneratedScript(scriptFile: string, headed: boolean, jiraStoryId?: string) {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const configPath = join(automationDir, 'playwright.config.ts');
    const scriptPath = join(automationDir, 'scripts', 'generated', scriptFile);

    if (!existsSync(scriptPath)) {
        throw new Error(`Generated script not found: ${scriptPath}`);
    }

    console.log('[AUTOMATION] Running generated script:', scriptPath);

    // Ensure report dir exists
    const reportDir = join(automationDir, '..', 'public', 'automation-reports', 'generated');
    if (!existsSync(reportDir)) {
        mkdirSync(reportDir, { recursive: true });
    }

    // Copy to tests/ directory so Playwright's testDir picks it up
    const tempTestFile = `_generated_${basename(scriptFile)}`;
    const testDir = join(automationDir, 'tests');
    const tempTestPath = join(testDir, tempTestFile);
    copyFileSync(scriptPath, tempTestPath);
    console.log('[AUTOMATION] Copied to tests dir:', tempTestPath);

    const cleanup = () => {
        try { unlinkSync(tempTestPath); } catch {}
    };

    return new Promise<{
        success: boolean;
        output: string;
        durationMs: number;
        stderr?: string;
    }>((resolvePromise, reject) => {
        const start = Date.now();

        const child = spawn('npx', [
            'playwright',
            'test',
            tempTestFile,
            '--config', configPath,
        ], {
            cwd: automationDir,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: false,
            detached: false,
            env: {
                ...process.env,
                FORCE_COLOR: '0',
                PW_REPORT_DIR: reportDir,
                PW_HEADED: headed ? 'true' : 'false',
            },
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk) => {
            const text = chunk.toString();
            stdout += text;
        });

        child.stderr?.on('data', (chunk) => {
            const text = chunk.toString();
            stderr += text;
        });

        child.on('error', (error) => {
            cleanup();
            reject({ error, durationMs: Date.now() - start, stdout, stderr });
        });

        const timeoutHandle = setTimeout(() => {
            child.kill();
        }, 30 * 60 * 1000);

        child.on('close', (code) => {
            clearTimeout(timeoutHandle);
            cleanup();
            const durationMs = Date.now() - start;
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
        const type = body?.type as string;
        const suite = body?.suite as string;
        const scriptFile = body?.scriptFile as string;
        const headed = body?.headed === true;

        // Handle generated script execution with streaming
        if (type === 'generated' && scriptFile) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    const addLog = (msg: string) => {
                        controller.enqueue(encoder.encode(msg + '\n'));
                    };

                    const addResult = (data: object) => {
                        controller.enqueue(encoder.encode('__RESULT__:' + JSON.stringify(data) + '\n'));
                    };

                    addLog('Launching browser...');
                    addLog(`Script: ${scriptFile}`);

                    try {
                        addLog('Running generated Playwright script...');
                        const result = await runGeneratedScript(scriptFile, headed, body?.jiraStoryId);

                        // Parse Playwright output for structured results
                        const passed: string[] = [];
                        const failed: string[] = [];
                        const lines = (result.output || '').split('\n');
                        for (const line of lines) {
                            const passMatch = line.match(/✓.*›\s(.+)/);
                            const failMatch = line.match(/✘.*›\s(.+)/);
                            if (passMatch) passed.push(passMatch[1].trim());
                            if (failMatch) failed.push(failMatch[1].trim());
                        }

                        addResult({
                            type: 'summary',
                            total: passed.length + failed.length,
                            passed: passed.length,
                            failed: failed.length,
                            durationMs: result.durationMs,
                            reportUrl: `/automation-reports/generated/index.html`,
                        });

                        if (result.success) {
                            addLog(`✓ All ${passed.length} tests passed in ${(result.durationMs / 1000).toFixed(1)}s`);
                        } else {
                            addLog(`✕ ${failed.length} failed, ${passed.length} passed in ${(result.durationMs / 1000).toFixed(1)}s`);
                        }

                        // Send individual test results
                        if (passed.length > 0) {
                            addResult({ type: 'passed', tests: passed });
                        }
                        if (failed.length > 0) {
                            addResult({ type: 'failed', tests: failed });
                        }

                        // Raw output for debugging
                        if (result.output) {
                            result.output.split('\n').filter(Boolean).forEach(line => addLog(line));
                        }
                    } catch (error: any) {
                        addLog(`✕ Execution error: ${error.message || String(error)}`);
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