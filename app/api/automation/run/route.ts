import { NextResponse } from 'next/server';
import { execSync, spawn } from 'child_process';
import { join, basename, relative } from 'path';
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync, readFileSync, readdirSync, statSync, cpSync, rmSync } from 'fs';
import { appendFile, mkdir, writeFile } from 'fs/promises';
import os from 'os';

const VALID_SUITES = ['smoke', 'sanity', 'regression'] as const;
type SuiteName = (typeof VALID_SUITES)[number];
type BrowserName = 'chromium' | 'firefox' | 'webkit' | 'all';

const SITE_NAVIGATION_TIMEOUT = 'SITE_NAVIGATION_TIMEOUT';

const SUITE_PATHS: Record<SuiteName, string[]> = {
    smoke: ['tests', 'smoke'],
    sanity: ['tests', 'sanity'],
    regression: ['tests', 'regression'],
};

const PROJECT_APP_NAME = 'SauceDemo';
const PROJECT_BASE_URL = process.env.SAUCEDEMO_BASE_URL || 'https://www.saucedemo.com';
const SUITE_METADATA = {
    appName: PROJECT_APP_NAME,
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

type HealingStatus = 'AUTO_HEALED' | 'PARTIALLY_HEALED' | 'NEEDS_MANUAL_REVIEW' | 'NOT_HEALABLE';
type HealingCategory = 'HEALABLE' | 'NOT_HEALABLE' | 'UNKNOWN';
type FailureType =
    | 'LOCATOR_NOT_FOUND'
    | 'ELEMENT_DETACHED'
    | 'ELEMENT_HIDDEN'
    | 'TIMING_ISSUE'
    | 'WAIT_ISSUE'
    | 'TEXT_ASSERTION_MISMATCH'
    | 'NAVIGATION_WAIT_ISSUE'
    | 'SITE_DOWN'
    | 'DNS_FAILURE'
    | 'SSL_FAILURE'
    | 'HTTP_5XX'
    | 'AUTHENTICATION_FAILURE'
    | 'INVALID_TEST_DATA'
    | 'BUSINESS_LOGIC_FAILURE'
    | 'UNKNOWN';

type FailureClassification = {
    type: FailureType;
    category: HealingCategory;
    rootCause: string;
};

type HealingChange = {
    kind: 'locator' | 'wait' | 'assertion';
    original: string;
    replacement: string;
    reason: string;
};

type HealingEvidence = {
    screenshots: string[];
    traces: string[];
    videos: string[];
    errorStackPath: string;
    testTitles: string[];
    failedLocator?: string;
};

type HealingAttemptResult = {
    attempted: boolean;
    finalStatus: HealingStatus;
    classification: FailureClassification;
    evidence: HealingEvidence;
    healedScriptPath?: string;
    failedOnlyGrep?: string;
    changes: HealingChange[];
    rerunResult?: PlaywrightRunResult;
    originalLocator?: string;
    replacementLocator?: string;
    error?: string;
};

function classifyFailure(output: string): FailureClassification {
    const cleanOutput = stripAnsi(output);
    const lower = cleanOutput.toLowerCase();
    if (output.includes(SITE_NAVIGATION_TIMEOUT) || lower.includes('net::err_connection') || lower.includes('site down')) {
        return { type: 'SITE_DOWN', category: 'NOT_HEALABLE', rootCause: 'Application was unreachable from the automation runtime.' };
    }
    if (lower.includes('net::err_name_not_resolved') || lower.includes('dns')) {
        return { type: 'DNS_FAILURE', category: 'NOT_HEALABLE', rootCause: 'DNS resolution failed.' };
    }
    if (lower.includes('ssl') || lower.includes('certificate') || lower.includes('net::err_cert')) {
        return { type: 'SSL_FAILURE', category: 'NOT_HEALABLE', rootCause: 'TLS or certificate validation failed.' };
    }
    if (/\b50\d\b/.test(output) || lower.includes('http 5')) {
        return { type: 'HTTP_5XX', category: 'NOT_HEALABLE', rootCause: 'Server returned a 5xx response.' };
    }
    if (lower.includes('epic sadface') || lower.includes('authentication') || lower.includes('unauthorized') || lower.includes('invalid credentials')) {
        return { type: 'AUTHENTICATION_FAILURE', category: 'NOT_HEALABLE', rootCause: 'Authentication failed or credentials were rejected.' };
    }
    if (lower.includes('test data') || lower.includes('csv') || lower.includes('expected at least one')) {
        return { type: 'INVALID_TEST_DATA', category: 'NOT_HEALABLE', rootCause: 'Input data required by the test is invalid or missing.' };
    }
    if (lower.includes('business') || lower.includes('order complete') || lower.includes('checkout')) {
        return { type: 'BUSINESS_LOGIC_FAILURE', category: 'NOT_HEALABLE', rootCause: 'Failure appears tied to product behavior rather than automation mechanics.' };
    }
    if (lower.includes('detached') || lower.includes('not attached to the dom')) {
        return { type: 'ELEMENT_DETACHED', category: 'HEALABLE', rootCause: 'Element detached while Playwright was interacting with it.' };
    }
    if (lower.includes('tohavetext') || lower.includes('expected string') || lower.includes('received string') || (lower.includes('expected:') && lower.includes('received:'))) {
        return { type: 'TEXT_ASSERTION_MISMATCH', category: 'HEALABLE', rootCause: 'Assertion text differs from runtime text.' };
    }
    if (/timeout:\s*\d{1,3}ms/i.test(cleanOutput)) {
        return { type: 'TIMING_ISSUE', category: 'HEALABLE', rootCause: 'A very short wait or assertion timeout expired before the UI became ready.' };
    }
    if (lower.includes('waiting for locator(') || /locator\([^)]*\)\.(click|fill|check|selectoption|hover|press):\s*timeout/i.test(cleanOutput)) {
        return { type: 'LOCATOR_NOT_FOUND', category: 'HEALABLE', rootCause: 'Locator could not resolve to a usable element.' };
    }
    if (lower.includes('not visible') || lower.includes('hidden') || lower.includes('to be visible')) {
        return { type: 'ELEMENT_HIDDEN', category: 'HEALABLE', rootCause: 'Element exists but is not visible at assertion or action time.' };
    }
    if (lower.includes('expect')) {
        return { type: 'TEXT_ASSERTION_MISMATCH', category: 'HEALABLE', rootCause: 'Assertion text differs from runtime text.' };
    }
    if (lower.includes('locator') || lower.includes('selector') || lower.includes('strict mode violation')) {
        return { type: 'LOCATOR_NOT_FOUND', category: 'HEALABLE', rootCause: 'Locator could not resolve to a usable element.' };
    }
    if (lower.includes('tohaveurl') || lower.includes('waitforurl') || lower.includes('navigation')) {
        return { type: 'NAVIGATION_WAIT_ISSUE', category: 'HEALABLE', rootCause: 'Navigation did not reach the expected state within the timeout.' };
    }
    if (lower.includes('waitfortimeout') || lower.includes('timeout')) {
        return { type: 'TIMING_ISSUE', category: 'HEALABLE', rootCause: 'A wait or action timed out before the UI became ready.' };
    }
    return { type: 'UNKNOWN', category: 'UNKNOWN', rootCause: 'Failure did not match a known healing pattern.' };
}

function failureReasonLabel(output: string) {
    const classification = classifyFailure(output);
    if (classification.type === 'SITE_DOWN') return SITE_NAVIGATION_TIMEOUT;
    return classification.type.toLowerCase().replace(/_/g, ' ');
}

function stripAnsi(value: string) {
    return value.replace(/\u001b\[[0-9;]*m/g, '');
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

function sanitizeFilePart(value: string) {
    return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'artifact';
}

function copyEvidenceFiles(files: string[], evidenceDir: string) {
    const copied: string[] = [];
    mkdirSync(evidenceDir, { recursive: true });
    for (const file of files) {
        if (!existsSync(file)) continue;
        const destination = join(evidenceDir, `${copied.length + 1}-${sanitizeFilePart(basename(file))}`);
        try {
            copyFileSync(file, destination);
            copied.push(destination);
        } catch {}
    }
    return copied;
}

function extractFailedTestTitles(result: PlaywrightRunResult, fallback: string[]) {
    const output = `${result.output || ''}\n${result.stderr || ''}`;
    const titles = new Set<string>(fallback.filter(Boolean));
    for (const line of output.split('\n')) {
        const failureList = line.match(/^\s*\d+\)\s+.*›\s+(.+)$/);
        if (failureList?.[1]) titles.add(failureList[1].trim());
        const bracketed = line.match(/\[[^\]]+\]\s+›\s+.*›\s+(.+)$/);
        if (bracketed?.[1] && /failed|error|timeout/i.test(output)) titles.add(bracketed[1].trim());
    }
    return [...titles]
        .map(title => title.replace(/\s+\(retry\s+#\d+\)/i, '').replace(/\s+\(\d+(?:\.\d+)?s\)$/, '').trim())
        .filter(Boolean)
        .filter((title, index, all) => all.indexOf(title) === index);
}

function extractFailedLocator(output: string) {
    const locatorPatterns = [
        /locator\((['"`][^'"`\n]+['"`])\)/,
        /(getBy(?:Role|Label|Placeholder|Text|TestId)\([^)\n]+\))/,
        /waiting for ([^\n]+locator\([^)]+\))/i,
    ];
    for (const pattern of locatorPatterns) {
        const match = output.match(pattern);
        if (match?.[1]) return match[1].trim();
    }
    return undefined;
}

function replacementForLocator(originalLocator: string) {
    const selector = originalLocator.replace(/^['"`]|['"`]$/g, '');
    const idMatch = selector.match(/^#([a-z0-9_-]+)$/i);
    const dataTestMatch = selector.match(/\[data-test(?:id)?=["']([^"']+)["']\]/i);
    const textMatch = selector.match(/text=(.+)/i);
    const normalizeToken = (value: string) => value
        .replace(/[-_](broken|missing|wrong|invalid|old|stale)$/i, '')
        .replace(/[-_]+$/, '');

    if (dataTestMatch?.[1]) {
        return { locator: `getByTestId('${normalizeToken(dataTestMatch[1])}')`, reason: 'Prefer data-test/data-testid selector.' };
    }
    if (idMatch?.[1]) {
        const id = normalizeToken(idMatch[1]);
        if (/button|login|submit|checkout|continue|finish|cancel|remove|add/i.test(id)) {
            const buttonName = id.replace(/[-_]*button$/i, '').replace(/[-_]+/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return { locator: `getByRole('button', { name: /${buttonName}/i })`, reason: 'Use accessible role before falling back to CSS.' };
        }
        return { locator: `getByTestId('${id}')`, reason: 'Try project data-test attribute derived from stable id.' };
    }
    if (textMatch?.[1]) {
        return { locator: `getByText(/${textMatch[1].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i)`, reason: 'Use text locator with case-insensitive matching.' };
    }
    if (/^\.[a-z0-9_-]+$/i.test(selector)) {
        return { locator: `locator('${selector}:visible')`, reason: 'Retain stable CSS selector but require visible element.' };
    }
    return undefined;
}

function applyLocatorHealing(source: string, failedLocator: string | undefined, changes: HealingChange[]) {
    if (!failedLocator) return source;
    const replacement = replacementForLocator(failedLocator);
    if (!replacement) return source;
    const escaped = failedLocator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const locatorCall = new RegExp(`\\.locator\\(${escaped}\\)`, 'g');
    const next = source.replace(locatorCall, `.${replacement.locator}`);
    if (next !== source) {
        changes.push({
            kind: 'locator',
            original: `.locator(${failedLocator})`,
            replacement: `.${replacement.locator}`,
            reason: replacement.reason,
        });
        return next;
    }
    return source;
}

function applyWaitHealing(source: string, changes: HealingChange[]) {
    const waitRegex = /await\s+([a-zA-Z0-9_$.]+)\.waitForTimeout\(\s*\d+\s*\);?/g;
    let next = source.replace(waitRegex, (_match, pageRef: string) => {
        const replacement = `await ${pageRef}.waitForLoadState('networkidle');`;
        changes.push({
            kind: 'wait',
            original: _match,
            replacement,
            reason: 'Replace hard timeout with Playwright load-state wait.',
        });
        return replacement;
    });
    next = next.replace(/timeout:\s*(\d{1,3})/g, (_match, timeoutValue: string) => {
        const replacement = 'timeout: 5000';
        changes.push({
            kind: 'wait',
            original: `timeout: ${timeoutValue}`,
            replacement,
            reason: 'Increase unrealistically short explicit timeout for Playwright auto-waiting.',
        });
        return replacement;
    });
    return next;
}

function parseExpectedActual(output: string) {
    const clean = stripAnsi(output);
    const expected = clean.match(/Expected(?: string)?:\s*["'`](.+?)["'`]/i)?.[1];
    const actual = clean.match(/Received(?: string)?:\s*["'`](.+?)["'`]/i)?.[1];
    if (!expected || !actual) return undefined;
    return { expected, actual };
}

function canHealAssertion(expected: string, actual: string) {
    if (expected.trim() === actual.trim()) return 'whitespace difference';
    if (expected.toLowerCase() === actual.toLowerCase()) return 'casing difference';
    const dynamicPattern = /\d{2,}|\d{4}-\d{2}-\d{2}|\$?\d+(?:\.\d{2})?/;
    if (dynamicPattern.test(expected) && dynamicPattern.test(actual)) return 'dynamic value pattern';
    return undefined;
}

function applyAssertionHealing(source: string, output: string, changes: HealingChange[]) {
    const pair = parseExpectedActual(output);
    if (!pair) return source;
    const reason = canHealAssertion(pair.expected, pair.actual);
    if (!reason) return source;
    const escapedExpected = pair.expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactText = new RegExp(`toHaveText\\((['"\`])${escapedExpected}\\1\\)`, 'g');
    const replacement = reason === 'dynamic value pattern'
        ? `toHaveText(/${pair.actual.replace(/\d+/g, '\\d+').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\\d\+/g, '\\d+')}/i)`
        : `toHaveText(/${pair.expected.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i)`;
    const next = source.replace(exactText, replacement);
    if (next !== source) {
        changes.push({
            kind: 'assertion',
            original: `toHaveText('${pair.expected}')`,
            replacement,
            reason: `Allowed assertion healing: ${reason}.`,
        });
    }
    return next;
}

function createHealedScript(params: {
    artifacts: RunArtifacts;
    sourceCode?: string;
    sourceFile?: string;
    classification: FailureClassification;
    output: string;
    failedLocator?: string;
}) {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const changes: HealingChange[] = [];
    const source = params.sourceCode ?? (params.sourceFile && existsSync(params.sourceFile) ? readFileSync(params.sourceFile, 'utf-8') : '');
    if (!source.trim()) return { changes, healedScriptPath: undefined };

    let healed = source;
    if (['LOCATOR_NOT_FOUND', 'ELEMENT_DETACHED', 'ELEMENT_HIDDEN'].includes(params.classification.type)) {
        healed = applyLocatorHealing(healed, params.failedLocator, changes);
    }
    if (['TIMING_ISSUE', 'WAIT_ISSUE', 'NAVIGATION_WAIT_ISSUE', 'ELEMENT_DETACHED', 'ELEMENT_HIDDEN'].includes(params.classification.type)) {
        healed = applyWaitHealing(healed, changes);
    }
    if (params.classification.type === 'TEXT_ASSERTION_MISMATCH') {
        healed = applyAssertionHealing(healed, params.output, changes);
    }

    const header = [
        '// Auto-healed by TCGen-Buddy.',
        `// Run ID: ${params.artifacts.runId}`,
        `// Failure Type: ${params.classification.type}`,
        '',
    ].join('\n');
    const healedScriptPath = join(automationDir, 'scripts', 'healed', `${params.artifacts.runId}.spec.ts`);
    mkdirSync(join(automationDir, 'scripts', 'healed'), { recursive: true });
    writeFileSync(healedScriptPath, `${header}${healed}`, 'utf-8');
    return { changes, healedScriptPath };
}

function buildFailedOnlyGrep(titles: string[]) {
    const escaped = titles
        .map(title => title.trim())
        .filter(Boolean)
        .map(title => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return escaped[0];
}

async function runHealedScript(healedScriptPath: string, grep: string | undefined, artifacts: RunArtifacts, options: {
    headed: boolean;
    browser: BrowserName;
    incognito?: boolean;
}) {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const configPath = join(automationDir, 'playwright.config.ts');
    const tempTestFile = `_healed_${basename(healedScriptPath)}`;
    const tempTestPath = join(automationDir, 'tests', tempTestFile);
    copyFileSync(healedScriptPath, tempTestPath);
    try {
        const args = ['playwright', 'test', `tests/${tempTestFile}`, '--config', configPath];
        if (grep) args.push('--grep', grep);
        if (options.browser !== 'all') args.push('--project', options.browser);
        return await runPlaywright(args, artifacts, {
            ...options,
            suiteName: 'healed',
            suiteApp: 'Healed Script',
        });
    } finally {
        try {
            unlinkSync(tempTestPath);
        } catch {}
    }
}

function collectHealingEvidence(params: {
    artifacts: RunArtifacts;
    result: PlaywrightRunResult;
    failedTests: string[];
}) {
    const rootDir = getProjectRoot();
    const evidenceDir = join(params.artifacts.healingDir, 'evidence');
    const errorStackPath = join(params.artifacts.healingDir, 'error-stack.txt');
    mkdirSync(params.artifacts.healingDir, { recursive: true });
    writeFileSync(errorStackPath, `${params.result.output || ''}\n${params.result.stderr || ''}`.trim(), 'utf-8');

    const searchRoots = [params.artifacts.tracesDir, params.artifacts.playwrightHtmlDir];
    const screenshots = copyEvidenceFiles(searchRoots.flatMap(dir => collectArtifactFiles(dir, ['.png'])).slice(0, 10), evidenceDir);
    const traces = copyEvidenceFiles(searchRoots.flatMap(dir => collectArtifactFiles(dir, ['.zip'])).slice(0, 10), evidenceDir);
    const videos = copyEvidenceFiles(searchRoots.flatMap(dir => collectArtifactFiles(dir, ['.webm'])).slice(0, 10), evidenceDir);
    const output = `${params.result.output || ''}\n${params.result.stderr || ''}`;
    return {
        screenshots: screenshots.map(file => relative(rootDir, file)),
        traces: traces.map(file => relative(rootDir, file)),
        videos: videos.map(file => relative(rootDir, file)),
        errorStackPath: relative(rootDir, errorStackPath),
        testTitles: extractFailedTestTitles(params.result, params.failedTests),
        failedLocator: extractFailedLocator(output),
    };
}

function writeHealingReport(params: {
    artifacts: RunArtifacts;
    attempt: HealingAttemptResult;
}) {
    const attempt = params.attempt;
    const report = [
        `# Healing Report - ${params.artifacts.runId}`,
        '',
        `Final Status: ${attempt.finalStatus}`,
        `Failure Type: ${attempt.classification.type}`,
        `Classification: ${attempt.classification.category}`,
        `Root Cause: ${attempt.classification.rootCause}`,
        '',
        '## Failed Tests',
        ...(attempt.evidence.testTitles.length ? attempt.evidence.testTitles.map(test => `- ${test}`) : ['- Unknown failed test']),
        '',
        '## Evidence',
        `- Error Stack: ${attempt.evidence.errorStackPath}`,
        `- Screenshots: ${attempt.evidence.screenshots.join(', ') || 'Not captured'}`,
        `- Traces: ${attempt.evidence.traces.join(', ') || 'Not captured'}`,
        `- Videos: ${attempt.evidence.videos.join(', ') || 'Not captured'}`,
        `- Failed Locator: ${attempt.evidence.failedLocator || 'Not detected'}`,
        '',
        '## Locator Healing',
        `- Original Locator: ${attempt.originalLocator || 'Not applicable'}`,
        `- Replacement Locator: ${attempt.replacementLocator || 'Not applicable'}`,
        '',
        '## Code Changes',
        ...(attempt.changes.length
            ? attempt.changes.map(change => `- ${change.kind}: ${change.original} -> ${change.replacement} (${change.reason})`)
            : ['- No safe automatic code change was generated.']),
        '',
        '## Re-run Result',
        `- Failed-only grep: ${attempt.failedOnlyGrep || 'Not available'}`,
        `- Healed Script: ${attempt.healedScriptPath || 'Not created'}`,
        `- Re-run Status: ${attempt.rerunResult ? (attempt.rerunResult.success ? 'PASS' : 'FAIL') : 'Not run'}`,
        attempt.error ? `- Error: ${attempt.error}` : '',
    ].filter(Boolean).join('\n');

    writeFileSync(params.artifacts.healingReportPath, report, 'utf-8');
}

async function attemptSelfHealing(params: {
    artifacts: RunArtifacts;
    result: PlaywrightRunResult;
    failedTests: string[];
    sourceCode?: string;
    sourceFile?: string;
    headed: boolean;
    browser: BrowserName;
    incognito?: boolean;
    log: (message: string) => void | Promise<void>;
}): Promise<HealingAttemptResult> {
    const output = `${params.result.output || ''}\n${params.result.stderr || ''}`;
    const classification = classifyFailure(output);
    const evidence = collectHealingEvidence({ artifacts: params.artifacts, result: params.result, failedTests: params.failedTests });
    await params.log(`[Healing] Failure classified: ${classification.type} (${classification.category})`);

    const baseAttempt: HealingAttemptResult = {
        attempted: false,
        finalStatus: classification.category === 'NOT_HEALABLE' ? 'NOT_HEALABLE' : 'NEEDS_MANUAL_REVIEW',
        classification,
        evidence,
        changes: [],
        originalLocator: evidence.failedLocator,
    };

    if (classification.category !== 'HEALABLE') {
        await params.log(`[Healing] Not healable: ${classification.rootCause}`);
        writeHealingReport({ artifacts: params.artifacts, attempt: baseAttempt });
        return baseAttempt;
    }

    await params.log('[Healing] Healing started');
    if (classification.type === 'LOCATOR_NOT_FOUND') await params.log('[Healing] Locator failure detected');

    const created = createHealedScript({
        artifacts: params.artifacts,
        sourceCode: params.sourceCode,
        sourceFile: params.sourceFile,
        classification,
        output,
        failedLocator: evidence.failedLocator,
    });

    const attempt: HealingAttemptResult = {
        ...baseAttempt,
        attempted: true,
        healedScriptPath: created.healedScriptPath,
        changes: created.changes,
        replacementLocator: created.changes.find(change => change.kind === 'locator')?.replacement,
    };

    if (!created.healedScriptPath || created.changes.length === 0) {
        attempt.finalStatus = 'NEEDS_MANUAL_REVIEW';
        attempt.error = 'No safe automatic code change was available.';
        await params.log('[Healing] No safe automatic code change was available');
        writeHealingReport({ artifacts: params.artifacts, attempt });
        return attempt;
    }

    for (const change of created.changes) {
        await params.log(`[Healing] ${change.kind === 'locator' ? 'Locator healed' : change.kind === 'wait' ? 'Wait healed' : 'Assertion healed'}: ${change.original} -> ${change.replacement}`);
    }

    const grep = buildFailedOnlyGrep(evidence.testTitles);
    attempt.failedOnlyGrep = grep;
    for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber += 1) {
        await params.log(`[Healing] Re-running failed test${evidence.testTitles.length === 1 ? '' : 's'} (attempt ${attemptNumber}/3)`);
        const rerun = await runHealedScript(created.healedScriptPath, grep, params.artifacts, {
            headed: params.headed,
            browser: params.browser,
            incognito: params.incognito,
        });
        attempt.rerunResult = rerun;
        if (rerun.success) {
            attempt.finalStatus = 'AUTO_HEALED';
            await params.log('[Healing] PASS');
            writeHealingReport({ artifacts: params.artifacts, attempt });
            return attempt;
        }
        await params.log('[Healing] Re-run failed');
    }

    attempt.finalStatus = 'PARTIALLY_HEALED';
    writeHealingReport({ artifacts: params.artifacts, attempt });
    return attempt;
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
                        if (generatedSummary.failed > 0) {
                            const healing = await attemptSelfHealing({
                                artifacts,
                                result,
                                failedTests: generatedSummary.failedTests,
                                sourceCode: scriptCode,
                                headed,
                                browser,
                                incognito,
                                log: addLog,
                            });
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
                        const payload = resultPayload({ suite: 'generated', status: finalResult.success ? 'completed' : 'failed', startedAt, artifacts, result: finalResult, output: `${result.output}\n${finalResult.output || ''}`, stderr: `${result.stderr || ''}\n${finalResult.stderr || ''}`, targetUrl, browser, headed, allureError: allure.error, healingError, logs: runLogs });
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
        if (summary.failed > 0) {
            const sourceFile = collectSuiteSourceFile(suite as SuiteName, summary.failedTests[0]);
            const healing = await attemptSelfHealing({
                artifacts,
                result,
                failedTests: summary.failedTests,
                sourceFile,
                headed,
                browser,
                incognito,
                log: (message) => appendExecutionLog(artifacts, runLogs, message),
            });
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
