import { NextResponse } from 'next/server';
import { execSync, spawn } from 'child_process';
import { join, basename, relative } from 'path';
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync, readFileSync, readdirSync, statSync, cpSync, rmSync } from 'fs';
import { appendFile, mkdir, writeFile } from 'fs/promises';
import os from 'os';
import { aiProviderOrchestrator, AiProviderId, ProviderSettings } from '@/src/services/ai/provider-orchestrator';
import { BrowserName, PlaywrightRunResult, RunArtifacts, SuiteName, VALID_SUITES } from '@/src/services/automation/types';
import { failureReasonLabel } from '@/src/services/self-healing/classifier';
import { collectArtifactFiles, getProjectRoot, PROJECT_BASE_URL } from '@/src/services/automation/utils';
import { healingStatusLabel } from '@/src/services/self-healing/report';
import { attemptSelfHealing } from '@/src/services/self-healing';
import { SITE_NAVIGATION_TIMEOUT } from '@/src/services/self-healing/types';
import type {
    HealingAttemptResult,
} from '@/src/services/self-healing/types';

const SUITE_PATHS: Record<SuiteName, string[]> = {
    smoke: ['tests', 'smoke'],
    sanity: ['tests', 'sanity'],
    regression: ['tests', 'regression'],
};

const PROJECT_APP_NAME = 'SauceDemo';
const SUITE_METADATA = {
    appName: PROJECT_APP_NAME,
};

function makeRunId(prefix: string) {
    const now = new Date();
    const stamp = [
        String(now.getDate()).padStart(2, '0'),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getFullYear()),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
    ].join('');
    const label = prefix
        .replace(/[^a-z0-9]/gi, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('') || 'Automation';
    return `${stamp}_${label}`;
}

function removeDirectoryIfSafe(path: string, root: string) {
    const relativePath = relative(root, path);
    if (!relativePath || relativePath.startsWith('..')) return false;
    if (!existsSync(path)) return false;
    rmSync(path, { recursive: true, force: true });
    return true;
}

function cleanupUnreferencedReportArtifacts(currentRunId: string) {
    const rootDir = getProjectRoot();
    const automationReportsDir = join(rootDir, 'automation', 'reports');
    const publicReportsDir = join(rootDir, 'public', 'automation-reports');
    const reportSubdirs = ['playwright-html', 'allure-results', 'allure-report', 'healing', 'logs', 'screenshots', 'traces'];
    const deleted: string[] = [];

    for (const subdir of reportSubdirs) {
        const baseDir = join(automationReportsDir, subdir);
        if (!existsSync(baseDir)) continue;
        for (const item of readdirSync(baseDir)) {
            const itemPath = join(baseDir, item);
            if (item === currentRunId || !statSync(itemPath).isDirectory()) continue;
            const publicCounterpart = join(publicReportsDir, item);
            if (existsSync(publicCounterpart)) continue;
            if (removeDirectoryIfSafe(itemPath, automationReportsDir)) deleted.push(relative(automationReportsDir, itemPath));
        }
    }

    if (existsSync(publicReportsDir)) {
        for (const item of readdirSync(publicReportsDir)) {
            const itemPath = join(publicReportsDir, item);
            if (item === currentRunId || !statSync(itemPath).isDirectory()) continue;
            const hasLinkedArtifact = [
                join(itemPath, 'playwright-html', 'index.html'),
                join(itemPath, 'allure-report', 'index.html'),
                join(itemPath, 'execution.log'),
                join(itemPath, 'healing-report.md'),
            ].some(existsSync);
            if (hasLinkedArtifact) continue;
            if (removeDirectoryIfSafe(itemPath, publicReportsDir)) deleted.push(relative(publicReportsDir, itemPath));
        }
    }

    return deleted;
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
    for (const dir of [artifacts.allureResultsDir, artifacts.allureReportDir]) {
        if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }

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

function addMemoryLog(logs: string[], message: string) {
    logs.push(message);
}

function suiteLabel(suite: SuiteName) {
    return suite.charAt(0).toUpperCase() + suite.slice(1);
}

function publishReports(artifacts: RunArtifacts) {
    const publicPlaywright = join(artifacts.publicRunDir, 'playwright-html');
    const publicAllure = join(artifacts.publicRunDir, 'allure-report');
    try {
        mkdirSync(artifacts.publicRunDir, { recursive: true });
        if (existsSync(join(artifacts.playwrightHtmlDir, 'index.html'))) {
            cpSync(artifacts.playwrightHtmlDir, publicPlaywright, { recursive: true, force: true });
        }
        if (existsSync(join(artifacts.allureReportDir, 'index.html'))) {
            cpSync(artifacts.allureReportDir, publicAllure, { recursive: true, force: true });
        }
        if (existsSync(artifacts.healingReportPath)) {
            copyFileSync(artifacts.healingReportPath, join(artifacts.publicRunDir, 'healing-report.md'));
        }
        if (existsSync(artifacts.logPath)) {
            copyFileSync(artifacts.logPath, join(artifacts.publicRunDir, 'execution.log'));
        }
        const deleted = cleanupUnreferencedReportArtifacts(artifacts.runId);
        if (deleted.length) {
            console.info('[AUTOMATION] Cleaned unreferenced report artifact folders:', deleted.join(', '));
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
    const resultFiles = collectAllureResultFiles(artifacts.allureResultsDir);
    if (resultFiles.length === 0) {
        console.warn('[ALLURE] No Allure result files found in:', artifacts.allureResultsDir);
        return { success: false, error: 'Allure results not found' };
    }

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
    incognito?: boolean;
    suiteName?: string;
    suiteApp?: string;
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
                SAUCEDEMO_BASE_URL: PROJECT_BASE_URL,
                RUN_ID: artifacts.runId,
                SUITE_NAME: options.suiteName || 'generated',
                SUITE_APP: options.suiteApp || 'Generated Script',
                BROWSER_NAME: options.browser,
                HEADLESS_MODE: options.headed ? 'headed' : 'headless',
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
    incognito?: boolean;
}): Promise<PlaywrightRunResult> {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const configPath = join(automationDir, 'playwright.config.ts');
    const suitePathParts = SUITE_PATHS[suite];
    const suitePath = join(automationDir, ...suitePathParts);

    if (!existsSync(suitePath)) {
        throw new Error(`Automation suite path not found: ${suitePath}`);
    }

    const suiteCliPath = suitePathParts.join('/');
    const args = ['playwright', 'test', suiteCliPath, '--config', configPath];
    if (options.browser !== 'all') args.push('--project', options.browser);
    return runPlaywright(args, artifacts, {
        ...options,
        suiteName: suite,
        suiteApp: SUITE_METADATA.appName,
    });
}

function collectSuiteSourceFile(suite: SuiteName, failedTitle?: string) {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const suitePath = join(automationDir, ...SUITE_PATHS[suite]);
    const specs = collectArtifactFiles(suitePath, ['.spec.ts']);
    if (!failedTitle || specs.length <= 1) return specs[0];
    return specs.find(file => {
        try {
            return readFileSync(file, 'utf-8').includes(failedTitle);
        } catch {
            return false;
        }
    }) || specs[0];
}

async function runGeneratedScript(scriptFile: string, artifacts: RunArtifacts, options: {
    headed: boolean;
    browser: BrowserName;
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
        const args = ['playwright', 'test', `tests/${tempTestFile}`, '--config', configPath];
        if (options.browser !== 'all') args.push('--project', options.browser);
        return await runPlaywright(args, artifacts, {
            ...options,
            suiteName: 'generated',
            suiteApp: 'Generated Script',
        });
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

function collectAllureResultFiles(dir: string) {
    return collectArtifactFiles(dir, ['-result.json', '-container.json']);
}

function escapePropertiesValue(value: unknown) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, ' ')
        .replace(/:/g, '\\:')
        .replace(/=/g, '\\=');
}

function writeAllureRunMetadata(params: {
    artifacts: RunArtifacts;
    browser: BrowserName;
    headed: boolean;
    suiteName: string;
    suiteApp: string;
}) {
    mkdirSync(params.artifacts.allureResultsDir, { recursive: true });
    const environment = [
        ['RUN_ID', params.artifacts.runId],
        ['SUITE_NAME', params.suiteName],
        ['SUITE_APP', params.suiteApp],
        ['BROWSER_NAME', params.browser],
        ['HEADLESS_MODE', params.headed ? 'headed' : 'headless'],
    ]
        .map(([key, value]) => `${key}=${escapePropertiesValue(value)}`)
        .join('\n');

    writeFileSync(join(params.artifacts.allureResultsDir, 'environment.properties'), `${environment}\n`, 'utf-8');
    writeFileSync(join(params.artifacts.allureResultsDir, 'executor.json'), JSON.stringify({
        name: 'TCGen-Buddy Automation Hub',
        type: 'playwright',
        buildName: params.suiteName,
        buildUrl: PROJECT_BASE_URL,
        reportName: `${params.artifacts.runId}`,
        reportUrl: params.artifacts.allureReportUrl,
    }, null, 2), 'utf-8');
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
    healingAttempt?: HealingAttemptResult;
    logs: string[];
}) {
    const summary = summarizePlaywrightResult(params.result);
    const playwrightReportUrl = availableUrl(params.artifacts.playwrightReportUrl, join(params.artifacts.playwrightHtmlDir, 'index.html'));
    const allureReportUrl = availableUrl(params.artifacts.allureReportUrl, join(params.artifacts.allureReportDir, 'index.html'));
    const healingReportUrl = availableUrl(params.artifacts.healingReportUrl, params.artifacts.healingReportPath);
    const logUrl = availableUrl(`/automation-reports/${params.artifacts.runId}/execution.log`, join(params.artifacts.publicRunDir, 'execution.log'));
    const hasReportError = Boolean(params.allureError || params.healingError || !playwrightReportUrl);
    const failureReason = params.result.success ? undefined : failureReasonLabel(`${params.result.output || ''}\n${params.stderr || ''}`);
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
        logUrl,
        runId: params.artifacts.runId,
        healingStatus: params.healingAttempt ? healingStatusLabel(params.healingAttempt.finalStatus) : undefined,
        failedTestsCount: params.healingAttempt ? Math.max(params.healingAttempt.evidence.testTitles.length, 1) : summary.failed,
        autoHealedCount: params.healingAttempt?.finalStatus === 'AUTO_HEALED' ? 1 : 0,
        manualReviewCount: params.healingAttempt && ['NEEDS_MANUAL_REVIEW', 'PARTIALLY_HEALED'].includes(params.healingAttempt.finalStatus) ? 1 : 0,
        healedScriptPath: params.healingAttempt?.healedScriptPath,
        healingEvent: params.healingAttempt?.memoryVaultEvent ? {
            ...params.healingAttempt.memoryVaultEvent,
            finalStatus: healingStatusLabel(params.healingAttempt.memoryVaultEvent.finalStatus),
            healedScriptPath: params.healingAttempt.healedScriptPath,
        } : undefined,
        logs: params.logs,
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        passedTests: summary.passedTests,
        failedTests: summary.failedTests,
        message: failureReason === SITE_NAVIGATION_TIMEOUT
            ? 'SITE_NAVIGATION_TIMEOUT'
            : status === 'failed'
                ? 'Test execution failed.'
                : status === 'partial_success'
                    ? 'Execution completed with report warnings.'
                    : 'Execution succeeded.',
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
        const incognito = body?.incognito === true;
        const aiProvider = (body?.provider || 'auto') as AiProviderId;
        const aiModel = typeof body?.model === 'string' ? body.model : undefined;
        const providerSettings = body?.providerSettings as ProviderSettings | undefined;
        const linkedStoryId = typeof body?.jiraStoryId === 'string' ? body.jiraStoryId : undefined;
        runId = makeRunId(type === 'generated' ? 'generated' : suite || 'suite');
        artifacts = makeArtifacts(runId);
        const startedAt = new Date().toISOString();
        const targetUrl = PROJECT_BASE_URL;
        const runLogs: string[] = [];
        addMemoryLog(runLogs, `Run ID: ${runId}`);
        addMemoryLog(runLogs, `Target URL: ${targetUrl}`);
        addMemoryLog(runLogs, `Browser: ${browser}`);
        addMemoryLog(runLogs, `Suite: ${type === 'generated' ? 'generated' : suite || 'unknown'}`);
        addMemoryLog(runLogs, `Mode: ${headed ? 'Headed' : 'Headless'}`);

        if (browser && !['chromium', 'firefox', 'webkit', 'all'].includes(browser)) {
            addMemoryLog(runLogs, 'Status: error');
            return NextResponse.json({ success: false, error: true, status: 'error', runId, logs: runLogs, message: 'Invalid browser. Expected chromium, firefox, webkit, or all.' }, { status: 400 });
        }

        await initializeRunArtifacts(artifacts);
        runLogs.length = 0;
        await appendExecutionLog(artifacts, runLogs, `Run ID: ${runId}`);
        await appendExecutionLog(artifacts, runLogs, `Target URL: ${targetUrl}`);
        await appendExecutionLog(artifacts, runLogs, `Browser: ${browser}`);
        await appendExecutionLog(artifacts, runLogs, `Suite: ${type === 'generated' ? 'generated' : suite || 'unknown'}`);
        await appendExecutionLog(artifacts, runLogs, `Suite app: ${type === 'generated' ? 'Generated Script' : SUITE_METADATA.appName}`);
        await appendExecutionLog(artifacts, runLogs, `Mode: ${headed ? 'Headed' : 'Headless'}`);
        await appendExecutionLog(artifacts, runLogs, 'Status: initialized');

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

                    try {
                        await validateEnvironment();
                        writeAllureRunMetadata({
                            artifacts,
                            browser,
                            headed,
                            suiteName: 'generated',
                            suiteApp: 'Generated Script',
                        });
                        addLog(`Launching ${browser}...`);
                        addLog('Running generated Playwright script...');
                        const result = await runGeneratedScript(scriptFile, artifacts, { headed, browser, incognito }, scriptCode);
                        let finalResult = result;
                        addLog(`Status: ${result.success ? 'passed' : 'failed'}`);
                        const generatedSummary = summarizePlaywrightResult(result);
                        let healingError: string | undefined;
                        let healingAttempt: HealingAttemptResult | undefined;
                        if (generatedSummary.failed > 0) {
                            const healing = await attemptSelfHealing({
                                artifacts,
                                result,
                                failedTests: generatedSummary.failedTests,
                                sourceCode: scriptCode,
                                sourceFile: join(getProjectRoot(), 'automation', 'scripts', 'generated', basename(scriptFile)),
                                suite: 'generated',
                                headed,
                                browser,
                                incognito,
                                aiProvider,
                                aiModel,
                                providerSettings,
                                linkedStoryId,
                                log: addLog,
                                runPlaywright,
                                generate: aiProviderOrchestrator.generate.bind(aiProviderOrchestrator),
                            });
                            healingAttempt = healing;
                            healingError = healing.finalStatus === 'AUTO_HEALED' ? undefined : healing.finalStatus;
                            if (healing.rerunResult?.success) finalResult = healing.rerunResult;
                            addLog(`Healing status: ${healing.finalStatus}`);
                        } else {
                            addLog('Healing skipped: no failed tests.');
                        }
                        addLog(existsSync(join(artifacts.playwrightHtmlDir, 'index.html')) ? 'Playwright report generated' : 'Playwright report not generated');
                        addLog('Generating Allure report...');
                        const allure = await runAllureGenerate(artifacts);
                        if (allure.success) addLog('Allure report generated');
                        else addLog(`Allure report not generated: ${allure.error}`);
                        for (const line of result.output.split('\n').filter(Boolean)) await appendExecutionLog(artifacts, runLogs, line);
                        for (const line of result.stderr?.split('\n').filter(Boolean) || []) await appendExecutionLog(artifacts, runLogs, line);
                        publishReports(artifacts);
                        const payload = resultPayload({ suite: 'generated', status: finalResult.success ? 'completed' : 'failed', startedAt, artifacts, result: finalResult, output: `${result.output}\n${finalResult.output || ''}`, stderr: `${result.stderr || ''}\n${finalResult.stderr || ''}`, targetUrl, browser, headed, allureError: allure.error, healingError, healingAttempt, logs: runLogs });
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
                            logUrl: existsSync(join(artifacts.publicRunDir, 'execution.log')) ? `/automation-reports/${runId}/execution.log` : null,
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
        await appendExecutionLog(artifacts, runLogs, `Selected suite: ${suiteLabel(suite as SuiteName)}`);
        await appendExecutionLog(artifacts, runLogs, `Browser launch mode: ${headed ? 'headed' : 'headless'}`);
        await appendExecutionLog(artifacts, runLogs, `Starting Playwright execution from ${SUITE_PATHS[suite as SuiteName].join('/')}`);
        writeAllureRunMetadata({
            artifacts,
            browser,
            headed,
            suiteName: suite,
            suiteApp: SUITE_METADATA.appName,
        });
        const result = await runPlaywrightSuite(suite as SuiteName, artifacts, { headed, browser, incognito });
        let finalResult = result;
        await appendExecutionLog(artifacts, runLogs, `Status: ${result.success ? 'passed' : 'failed'}`);
        const summary = summarizePlaywrightResult(result);
        const failureReason = result.success ? undefined : failureReasonLabel(`${result.output}\n${result.stderr}`);
        if (failureReason) {
            await appendExecutionLog(artifacts, runLogs, `Final failure reason: ${failureReason}`);
            if (failureReason === SITE_NAVIGATION_TIMEOUT && !headed) {
                await appendExecutionLog(artifacts, runLogs, 'Headless navigation timed out. Try headed mode.');
            }
        }
        let healingError: string | undefined;
        let healingAttempt: HealingAttemptResult | undefined;
        if (summary.failed > 0) {
            const sourceFile = collectSuiteSourceFile(suite as SuiteName, summary.failedTests[0]);
            const healing = await attemptSelfHealing({
                artifacts,
                result,
                failedTests: summary.failedTests,
                sourceFile,
                suite,
                headed,
                browser,
                incognito,
                aiProvider,
                aiModel,
                providerSettings,
                linkedStoryId,
                log: (message) => appendExecutionLog(artifacts, runLogs, message),
                runPlaywright,
                generate: aiProviderOrchestrator.generate.bind(aiProviderOrchestrator),
            });
            healingAttempt = healing;
            healingError = healing.finalStatus === 'AUTO_HEALED' ? undefined : healing.finalStatus;
            if (healing.rerunResult?.success) finalResult = healing.rerunResult;
            await appendExecutionLog(artifacts, runLogs, `Healing status: ${healing.finalStatus}`);
        } else {
            await appendExecutionLog(artifacts, runLogs, 'Healing skipped: no failed tests.');
        }
        await appendExecutionLog(artifacts, runLogs, existsSync(join(artifacts.playwrightHtmlDir, 'index.html')) ? 'Playwright report generated' : 'Playwright report not generated');
        await appendExecutionLog(artifacts, runLogs, 'Generating Allure report...');
        const allure = await runAllureGenerate(artifacts);
        await appendExecutionLog(artifacts, runLogs, allure.success ? 'Allure report generated' : `Allure report not generated: ${allure.error}`);
        for (const line of result.output.split('\n').filter(Boolean)) await appendExecutionLog(artifacts, runLogs, line);
        for (const line of result.stderr?.split('\n').filter(Boolean) || []) await appendExecutionLog(artifacts, runLogs, line);
        publishReports(artifacts);

        const payload = resultPayload({
            suite,
            status: finalResult.success ? 'completed' : 'failed',
            startedAt,
            artifacts,
            result: finalResult,
            output: `${result.output}\n${finalResult.output || ''}`,
            stderr: `${result.stderr || ''}\n${finalResult.stderr || ''}`,
            targetUrl,
            browser,
            headed,
            allureError: allure.error,
            healingError,
            healingAttempt,
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
