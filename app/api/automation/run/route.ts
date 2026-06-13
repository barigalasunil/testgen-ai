import { NextResponse } from 'next/server';
import { execSync, spawn } from 'child_process';
import { join, basename, relative } from 'path';
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync, readdirSync, statSync, cpSync } from 'fs';
import { appendFile, mkdir, writeFile } from 'fs/promises';
import os from 'os';

const VALID_SUITES = ['smoke', 'sanity', 'regression'] as const;
type SuiteName = (typeof VALID_SUITES)[number];
type BrowserName = 'chromium' | 'firefox' | 'webkit' | 'all';

const SUITE_PATHS: Record<SuiteName, string[]> = {
    smoke: ['tests', 'smoke'],
    sanity: ['tests', 'sanity'],
    regression: ['tests', 'regression'],
};

type PlaywrightRunResult = {
    success: boolean;
    output: string;
    durationMs: number;
    stderr?: string;
};

type RunArtifacts = {
    runId: string;
    playwrightHtmlDir: string;
    allureResultsDir: string;
    allureReportDir: string;
    publicRunDir: string;
    playwrightReportUrl: string;
    allureReportUrl: string;
    healingDir: string;
    healingReportPath: string;
    healingReportUrl: string;
    logsDir: string;
    logPath: string;
    screenshotsDir: string;
    tracesDir: string;
};

function getProjectRoot(): string {
    let root = process.cwd();
    if (root.includes('.next') || root.includes('dist')) {
        root = root.split('.next')[0].split('dist')[0];
    }
    return root;
}

function makeRunId(prefix: string) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
    return `${prefix}-${stamp}`;
}

function makeArtifacts(runId: string): RunArtifacts {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const publicRunDir = join(rootDir, 'public', 'automation-reports', runId);
    const artifacts = {
        runId,
        playwrightHtmlDir: join(automationDir, 'reports', 'playwright-html', runId),
        allureResultsDir: join(automationDir, 'reports', 'allure-results', runId),
        allureReportDir: join(automationDir, 'reports', 'allure-report', runId),
        publicRunDir,
        playwrightReportUrl: `/automation-reports/${runId}/playwright-html/index.html`,
        allureReportUrl: `/automation-reports/${runId}/allure-report/index.html`,
        healingDir: join(automationDir, 'reports', 'healing', runId),
        healingReportPath: join(automationDir, 'reports', 'healing', runId, 'healing-report.md'),
        healingReportUrl: `/automation-reports/${runId}/healing-report.md`,
        logsDir: join(automationDir, 'reports', 'logs', runId),
        logPath: join(automationDir, 'reports', 'logs', runId, 'execution.log'),
        screenshotsDir: join(automationDir, 'reports', 'screenshots', runId),
        tracesDir: join(automationDir, 'reports', 'traces', runId),
    };

    return artifacts;
}

async function initializeRunArtifacts(artifacts: RunArtifacts) {
    await Promise.all([
        mkdir(artifacts.logsDir, { recursive: true }),
        mkdir(artifacts.playwrightHtmlDir, { recursive: true }),
        mkdir(artifacts.allureResultsDir, { recursive: true }),
        mkdir(artifacts.allureReportDir, { recursive: true }),
        mkdir(artifacts.healingDir, { recursive: true }),
        mkdir(artifacts.screenshotsDir, { recursive: true }),
        mkdir(artifacts.tracesDir, { recursive: true }),
        mkdir(artifacts.publicRunDir, { recursive: true }),
    ]);
    try {
        await writeFile(artifacts.logPath, '', 'utf-8');
    } catch (error) {
        console.warn('[AUTOMATION] execution.log creation failed:', error instanceof Error ? error.message : String(error));
    }
}

async function appendExecutionLog(artifacts: RunArtifacts, logs: string[], message: string) {
    logs.push(message);
    try {
        await mkdir(artifacts.logsDir, { recursive: true });
        await appendFile(artifacts.logPath, `${message}\n`, 'utf-8');
    } catch (error) {
        console.warn('[AUTOMATION] execution.log append failed:', error instanceof Error ? error.message : String(error));
    }
}

function publishReports(artifacts: RunArtifacts) {
    const publicPlaywright = join(artifacts.publicRunDir, 'playwright-html');
    const publicAllure = join(artifacts.publicRunDir, 'allure-report');
    try {
        if (existsSync(join(artifacts.playwrightHtmlDir, 'index.html'))) {
            cpSync(artifacts.playwrightHtmlDir, publicPlaywright, { recursive: true, force: true });
        }
        if (existsSync(join(artifacts.allureReportDir, 'index.html'))) {
            cpSync(artifacts.allureReportDir, publicAllure, { recursive: true, force: true });
        }
        if (existsSync(artifacts.healingReportPath)) {
            copyFileSync(artifacts.healingReportPath, join(artifacts.publicRunDir, 'healing-report.md'));
        }
    } catch (error) {
        console.warn('[AUTOMATION] Report publishing failed:', error instanceof Error ? error.message : String(error));
    }
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
            env: { ...process.env, PW_REPORT_DIR: os.tmpdir(), ALLURE_RESULTS_DIR: join(os.tmpdir(), 'allure-results') },
        });
    } catch {
        throw new Error('Playwright browser binaries are missing. Run: npx playwright install chromium');
    }
}

function runCommand(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise(resolve => {
        const child = spawn(command, args, {
            cwd,
            env,
            shell: process.platform === 'win32',
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', chunk => {
            stdout += chunk.toString();
        });
        child.stderr?.on('data', chunk => {
            stderr += chunk.toString();
        });
        child.on('error', error => {
            resolve({ success: false, output: stdout, error: error.message });
        });
        child.on('close', code => {
            resolve({
                success: code === 0,
                output: `${stdout}${stderr ? `\n${stderr}` : ''}`.trim(),
                error: code === 0 ? undefined : (stderr || stdout || `Command exited with ${code}`),
            });
        });
    });
}

async function runAllureGenerate(artifacts: RunArtifacts) {
    const rootDir = getProjectRoot();
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'npx.cmd' : 'npx';
    mkdirSync(artifacts.allureReportDir, { recursive: true });
    const result = await runCommand(cmd, ['allure', 'generate', artifacts.allureResultsDir, '-o', artifacts.allureReportDir, '--clean'], rootDir, process.env);
    if (!result.success) {
        const message = result.error || 'Allure report generation failed. Install allure-commandline or check Java setup.';
        console.warn('[ALLURE] Report generation failed:', message);
        return { success: false, error: 'Allure report generation failed. Install allure-commandline or check Java setup.' };
    }
    return { success: existsSync(join(artifacts.allureReportDir, 'index.html')), error: undefined };
}

function runPlaywright(args: string[], artifacts: RunArtifacts, options: {
    headed: boolean;
    browser: BrowserName;
    customUrl?: string;
    incognito?: boolean;
}): Promise<PlaywrightRunResult> {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');

    return new Promise((resolve, reject) => {
        const start = Date.now();
        const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
            cwd: automationDir,
            shell: process.platform === 'win32',
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: !options.headed,
            detached: false,
            env: {
                ...process.env,
                SAUCEDEMO_BASE_URL: options.customUrl || process.env.SAUCEDEMO_BASE_URL || 'https://www.saucedemo.com',
                PW_REPORT_DIR: artifacts.playwrightHtmlDir,
                ALLURE_RESULTS_DIR: artifacts.allureResultsDir,
                PW_OUTPUT_DIR: artifacts.tracesDir,
                PW_HEADED: options.headed ? 'true' : 'false',
                PW_BROWSER: options.browser,
                PW_INCOGNITO: options.incognito ? 'true' : 'false',
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

async function runPlaywrightSuite(suite: SuiteName, artifacts: RunArtifacts, options: {
    headed: boolean;
    browser: BrowserName;
    customUrl?: string;
    incognito?: boolean;
}): Promise<PlaywrightRunResult> {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const configPath = join(automationDir, 'playwright.config.ts');
    const suitePath = join(automationDir, ...SUITE_PATHS[suite]);

    if (!existsSync(suitePath)) {
        throw new Error(`Automation suite path not found: ${suitePath}`);
    }

    const suiteCliPath = SUITE_PATHS[suite].join('/');
    const args = ['playwright', 'test', suiteCliPath, '--config', configPath];
    if (options.browser !== 'all') args.push('--project', options.browser);
    return runPlaywright(args, artifacts, options);
}

async function runGeneratedScript(scriptFile: string, artifacts: RunArtifacts, options: {
    headed: boolean;
    browser: BrowserName;
    customUrl?: string;
    incognito?: boolean;
}, scriptCode?: string): Promise<PlaywrightRunResult> {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const configPath = join(automationDir, 'playwright.config.ts');
    const safeScriptFile = basename(scriptFile);
    const generatedDir = join(automationDir, 'scripts', 'generated');
    const scriptPath = join(generatedDir, safeScriptFile);

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
        const args = ['playwright', 'test', tempTestFile, '--config', configPath];
        if (options.browser !== 'all') args.push('--project', options.browser);
        return await runPlaywright(args, artifacts, options);
    } finally {
        try {
            unlinkSync(tempTestPath);
        } catch {}
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

function classifyFailure(output: string) {
    const lower = output.toLowerCase();
    if (lower.includes('locator') || lower.includes('selector')) return 'selector not found';
    if (lower.includes('timeout')) return 'timeout';
    if (lower.includes('expect') || lower.includes('tohave')) return 'assertion mismatch';
    if (lower.includes('not visible')) return 'element not visible';
    if (lower.includes('navigation')) return 'navigation failure';
    if (lower.includes('net::') || lower.includes('network')) return 'network/load delay';
    return 'needs analysis';
}

function collectArtifactFiles(dir: string, suffixes: string[]) {
    const found: string[] = [];
    if (!existsSync(dir)) return found;
    const walk = (current: string) => {
        for (const item of readdirSync(current)) {
            const full = join(current, item);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else if (suffixes.some(suffix => item.endsWith(suffix))) {
                found.push(full);
            }
        }
    };
    walk(dir);
    return found;
}

function writeHealingReport(params: {
    artifacts: RunArtifacts;
    result: PlaywrightRunResult;
    failedTests: string[];
    scriptFile?: string;
    scriptCode?: string;
}) {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    mkdirSync(params.artifacts.healingDir, { recursive: true });
    const reason = classifyFailure(`${params.result.output}\n${params.result.stderr}`);
    const screenshots = collectArtifactFiles(join(automationDir, 'reports'), ['.png']).slice(0, 10);
    const traces = collectArtifactFiles(join(automationDir, 'reports'), ['.zip']).slice(0, 10);
    const failedTests = params.failedTests.length ? params.failedTests : ['Unknown failed test'];
    const healedScriptDir = join(automationDir, 'scripts', 'healed', params.artifacts.runId);
    mkdirSync(healedScriptDir, { recursive: true });

    if (params.scriptCode?.trim()) {
        const healedName = `${basename(params.scriptFile || 'generated.spec.ts', '.ts')}.healed.spec.ts`;
        writeFileSync(join(healedScriptDir, healedName), [
            params.scriptCode,
            '',
            '// Self-healing review notes:',
            `// Failure type: ${reason}`,
            '// Status: Needs Manual Review',
        ].join('\n'), 'utf-8');
    }

    const report = [
        `# Healing Report - ${params.artifacts.runId}`,
        '',
        `Final status: ${params.result.success ? 'Passed' : 'Needs Manual Review'}`,
        `Failure reason: ${reason}`,
        '',
        '## Failed Tests',
        ...failedTests.map(test => `- ${test}`),
        '',
        '## Evidence',
        `- Screenshots: ${screenshots.map(file => relative(rootDir, file)).join(', ') || 'Not captured'}`,
        `- Traces: ${traces.map(file => relative(rootDir, file)).join(', ') || 'Not captured'}`,
        '',
        '## Healing Attempts',
        '- Attempt 1: Evidence captured and failure classified.',
        '- Attempt 2: Healed script stub saved when generated script was available.',
        '- Attempt 3: Marked as Needs Manual Review if failure persists.',
        '',
        '## Recommended Healing Strategy',
        '- Prefer data-testid, role, label, placeholder, text, then stable CSS selectors.',
        '- Replace hard waits with locator waits and Playwright expect auto-waiting.',
        '- Verify UI text changes before changing assertions.',
    ].join('\n');

    writeFileSync(params.artifacts.healingReportPath, report, 'utf-8');
}

function safeWriteHealingReport(params: Parameters<typeof writeHealingReport>[0]) {
    try {
        writeHealingReport(params);
        return { success: existsSync(params.artifacts.healingReportPath), error: undefined };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[HEALING] Report generation failed:', message);
        return { success: false, error: 'Healing report not generated for this run.' };
    }
}

function availableUrl(url: string, filePath: string) {
    return existsSync(filePath) ? url : null;
}

function resultPayload(params: {
    suite?: string;
    status: 'completed' | 'failed';
    startedAt: string;
    artifacts: RunArtifacts;
    result: PlaywrightRunResult;
    output?: string;
    stderr?: string;
    targetUrl?: string;
    browser: BrowserName;
    headed: boolean;
    allureError?: string;
    healingError?: string;
    logs: string[];
}) {
    const summary = summarizePlaywrightResult(params.result);
    const playwrightReportUrl = availableUrl(params.artifacts.playwrightReportUrl, join(params.artifacts.playwrightHtmlDir, 'index.html'));
    const allureReportUrl = availableUrl(params.artifacts.allureReportUrl, join(params.artifacts.allureReportDir, 'index.html'));
    const healingReportUrl = availableUrl(params.artifacts.healingReportUrl, params.artifacts.healingReportPath);
    const hasReportError = Boolean(params.allureError || params.healingError || !playwrightReportUrl);
    const status = params.status === 'failed'
        ? 'failed'
        : hasReportError
            ? 'partial_success'
            : 'passed';
    return {
        success: status === 'passed' || status === 'partial_success',
        error: status === 'failed',
        suite: params.suite,
        status,
        executionStatus: params.result.success ? 'passed' : 'failed',
        startedAt: params.startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: params.result.durationMs,
        targetUrl: params.targetUrl,
        browser: params.browser,
        mode: params.headed ? 'Headed' : 'Headless',
        reportUrl: playwrightReportUrl,
        playwrightReportUrl,
        allureReportUrl,
        healingReportUrl,
        runId: params.artifacts.runId,
        logs: params.logs,
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        passedTests: summary.passedTests,
        failedTests: summary.failedTests,
        message: status === 'failed' ? 'Test execution failed.' : status === 'partial_success' ? 'Execution completed with report warnings.' : 'Execution succeeded.',
        errors: {
            playwrightReport: playwrightReportUrl ? undefined : 'Report not generated',
            allureReport: params.allureError,
            healingReport: params.healingError,
        },
        output: params.output,
        stderr: params.stderr,
    };
}

export async function POST(request: Request) {
    let runId = makeRunId('automation');
    let artifacts: RunArtifacts = makeArtifacts(runId);
    try {
        const body = await request.json();
        const type = body?.type as string;
        const suite = body?.suite as string;
        const scriptFile = body?.scriptFile as string;
        const scriptCode = typeof body?.scriptCode === 'string' ? body.scriptCode : undefined;
        const headed = body?.headed === true;
        const browser = (body?.browser || 'chromium') as BrowserName;
        const customUrl = typeof body?.customUrl === 'string' && body.customUrl.trim() ? body.customUrl.trim() : undefined;
        const sessionTargetUrl = typeof body?.targetUrl === 'string' && body.targetUrl.trim() ? body.targetUrl.trim() : undefined;
        const incognito = body?.incognito === true;
        runId = makeRunId(customUrl ? 'custom-url' : type === 'generated' ? 'generated' : suite || 'suite');
        artifacts = makeArtifacts(runId);
        await initializeRunArtifacts(artifacts);
        const startedAt = new Date().toISOString();
        const targetUrl = customUrl || sessionTargetUrl || process.env.SAUCEDEMO_BASE_URL || 'https://www.saucedemo.com';
        const runLogs: string[] = [];
        await appendExecutionLog(artifacts, runLogs, `Run ID: ${runId}`);
        await appendExecutionLog(artifacts, runLogs, `Target URL: ${targetUrl}`);
        await appendExecutionLog(artifacts, runLogs, `Browser: ${browser}`);
        await appendExecutionLog(artifacts, runLogs, `Suite: ${type === 'generated' ? 'generated' : suite || 'unknown'}`);
        await appendExecutionLog(artifacts, runLogs, `Mode: ${headed ? 'Headed' : 'Headless'}`);
        await appendExecutionLog(artifacts, runLogs, 'Status: initialized');

        if (browser && !['chromium', 'firefox', 'webkit', 'all'].includes(browser)) {
            await appendExecutionLog(artifacts, runLogs, 'Status: error');
            return NextResponse.json({ success: false, error: true, status: 'error', runId, logs: runLogs, message: 'Invalid browser. Expected chromium, firefox, webkit, or all.' }, { status: 400 });
        }

        if (type === 'generated' && scriptFile) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    const addLog = (message: string) => {
                        controller.enqueue(encoder.encode(`${message}\n`));
                        void appendExecutionLog(artifacts, runLogs, message);
                    };
                    const addResult = (data: object) => {
                        controller.enqueue(encoder.encode(`__RESULT__:${JSON.stringify(data)}\n`));
                    };

                    addLog('Launching automation execution...');
                    addLog(`Script: ${basename(scriptFile)}`);
                    addLog(`Run ID: ${runId}`);
                    if (customUrl) addLog(`Opening custom URL: ${customUrl}`);

                    try {
                        await validateEnvironment();
                        addLog(`Launching ${browser}...`);
                        addLog('Running generated Playwright script...');
                        const result = await runGeneratedScript(scriptFile, artifacts, { headed, browser, customUrl: targetUrl, incognito }, scriptCode);
                        addLog(`Status: ${result.success ? 'passed' : 'failed'}`);
                        addLog(existsSync(join(artifacts.playwrightHtmlDir, 'index.html')) ? 'Playwright report generated' : 'Playwright report not generated');
                        addLog('Generating Allure report...');
                        const allure = await runAllureGenerate(artifacts);
                        if (allure.success) addLog('Allure report generated');
                        else addLog(`Allure report not generated: ${allure.error}`);
                        const generatedSummary = summarizePlaywrightResult(result);
                        const healing = generatedSummary.failed > 0
                            ? safeWriteHealingReport({ artifacts, result, failedTests: generatedSummary.failedTests, scriptFile, scriptCode })
                            : { success: false, error: undefined };
                        if (healing.success) addLog('Healing report generated');
                        else addLog(generatedSummary.failed > 0 ? 'Healing report not generated for this run.' : 'Healing skipped: no failed tests.');
                        for (const line of result.output.split('\n').filter(Boolean)) await appendExecutionLog(artifacts, runLogs, line);
                        for (const line of result.stderr?.split('\n').filter(Boolean) || []) await appendExecutionLog(artifacts, runLogs, line);
                        publishReports(artifacts);
                        const payload = resultPayload({ status: result.success ? 'completed' : 'failed', startedAt, artifacts, result, output: result.output, stderr: result.stderr, targetUrl, browser, headed, allureError: allure.error, healingError: healing.error, logs: runLogs });
                        addResult({ type: 'summary', ...payload });
                        if (payload.passedTests.length > 0) addResult({ type: 'passed', tests: payload.passedTests });
                        if (payload.failedTests.length > 0) addResult({ type: 'failed', tests: payload.failedTests });
                        addLog(`Passed: ${payload.passed}`);
                        addLog(`Failed: ${payload.failed}`);
                        addLog(`Playwright HTML Report: ${payload.playwrightReportUrl}`);
                        addLog(`Allure Report: ${payload.allureReportUrl}`);
                        if (payload.failed > 0 && payload.healingReportUrl) addLog('Self-healing evidence analysis completed.');
                        addLog(`Healing Report: ${payload.healingReportUrl || 'Not Generated'}`);
                        result.output.split('\n').filter(Boolean).forEach(addLog);
                        result.stderr?.split('\n').filter(Boolean).forEach(addLog);
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        addLog(`Execution error: ${message}`);
                        addResult({
                            type: 'summary',
                            total: 1,
                            passed: 0,
                            failed: 1,
                            durationMs: 0,
                            reportUrl: null,
                            playwrightReportUrl: null,
                            allureReportUrl: null,
                            healingReportUrl: null,
                            runId,
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
            await appendExecutionLog(artifacts, runLogs, 'Status: error');
            return NextResponse.json(
                { success: false, error: true, status: 'error', runId, logs: runLogs, message: 'Invalid suite. Expected smoke, sanity, or regression.' },
                { status: 400 }
            );
        }

        await validateEnvironment();
        await appendExecutionLog(artifacts, runLogs, 'Status: environment validated');
        await appendExecutionLog(artifacts, runLogs, 'Starting Playwright execution');
        const result = await runPlaywrightSuite(suite as SuiteName, artifacts, { headed, browser, customUrl: targetUrl, incognito });
        await appendExecutionLog(artifacts, runLogs, `Status: ${result.success ? 'passed' : 'failed'}`);
        await appendExecutionLog(artifacts, runLogs, existsSync(join(artifacts.playwrightHtmlDir, 'index.html')) ? 'Playwright report generated' : 'Playwright report not generated');
        await appendExecutionLog(artifacts, runLogs, 'Generating Allure report');
        const allure = await runAllureGenerate(artifacts);
        await appendExecutionLog(artifacts, runLogs, allure.success ? 'Allure report generated' : `Allure report not generated: ${allure.error}`);
        const summary = summarizePlaywrightResult(result);
        const healing = summary.failed > 0
            ? safeWriteHealingReport({ artifacts, result, failedTests: summary.failedTests })
            : { success: false, error: undefined };
        await appendExecutionLog(
            artifacts,
            runLogs,
            healing.success
                ? 'Healing report generated'
                : summary.failed > 0
                    ? 'Healing report not generated for this run.'
                    : 'Healing skipped: no failed tests.'
        );
        for (const line of result.output.split('\n').filter(Boolean)) await appendExecutionLog(artifacts, runLogs, line);
        for (const line of result.stderr?.split('\n').filter(Boolean) || []) await appendExecutionLog(artifacts, runLogs, line);
        publishReports(artifacts);

        const payload = resultPayload({
            suite,
            status: result.success ? 'completed' : 'failed',
            startedAt,
            artifacts,
            result,
            output: result.output,
            stderr: result.stderr,
            targetUrl,
            browser,
            headed,
            allureError: allure.error,
            healingError: healing.error,
            logs: runLogs,
        });

        return NextResponse.json(payload, { status: 200 });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[API ERROR]', msg);
        const errorLogs = [`Run ID: ${runId}`, `Status: error`, `Execution error: ${msg}`];
        for (const line of errorLogs) {
            await appendExecutionLog(artifacts, [], line);
        }
        return NextResponse.json(
            {
                success: false,
                error: true,
                status: 'error',
                runId,
                logs: errorLogs,
                playwrightReportUrl: null,
                allureReportUrl: null,
                healingReportUrl: artifacts && existsSync(artifacts.healingReportPath) ? artifacts.healingReportUrl : null,
                errors: { execution: msg },
                message: `Automation failed: ${msg}`,
            },
            { status: 500 }
        );
    }
}
