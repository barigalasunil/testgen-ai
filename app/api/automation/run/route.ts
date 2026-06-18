import { NextResponse } from 'next/server';
import { execSync, spawn } from 'child_process';
import { join, basename, relative } from 'path';
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync, readFileSync, readdirSync, statSync, cpSync, rmSync } from 'fs';
import { appendFile, mkdir, writeFile } from 'fs/promises';
import os from 'os';
import { aiProviderOrchestrator, AiProviderId, ProviderSettings } from '@/src/services/ai/provider-orchestrator';

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
    failureType: FailureType;
    category: HealingCategory;
    isHealable: boolean;
    confidence: number;
    rootCause: string;
    reason: string;
};

type HealingChange = {
    kind: 'locator' | 'wait' | 'assertion';
    original: string;
    replacement: string;
    reason: string;
};

type HealingEvidence = {
    testTitle: string;
    specFilePath?: string;
    failedLineNumber?: number;
    errorMessage: string;
    stackTrace: string;
    screenshotPath?: string;
    tracePath?: string;
    videoPath?: string;
    currentUrl?: string;
    browser: BrowserName;
    suite: string;
    runId: string;
    screenshots: string[];
    traces: string[];
    videos: string[];
    errorStackPath: string;
    evidenceJsonPath: string;
    testTitles: string[];
    failedLocator?: string;
};

type DomCandidates = {
    url?: string;
    buttons: string[];
    inputs: string[];
    labels: string[];
    placeholders: string[];
    links: string[];
    headings: string[];
    ariaLabels: string[];
    testIds: string[];
    textCandidates: string[];
};

type AiHealingSuggestion = {
    canHeal: boolean;
    healingType: 'locator' | 'wait' | 'assertion';
    originalCode: string;
    healedCode: string;
    reason: string;
    confidence: number;
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
    confidence: number;
    reason: string;
    domCandidatesPath?: string;
    domCandidateCount?: number;
    aiSuggestion?: AiHealingSuggestion;
    aiPromptPath?: string;
    memoryVaultEvent?: {
        sourceType: 'self_healing_event';
        runId: string;
        suite: string;
        testTitle: string;
        failureType: FailureType;
        originalLocator?: string;
        healedLocator?: string;
        finalStatus: HealingStatus;
        confidence: number;
        linkedAutomationRunId: string;
        linkedStoryId?: string;
        healedScriptPath?: string;
        createdAt: string;
    };
    error?: string;
};

function healingStatusLabel(status: HealingStatus) {
    const labels: Record<HealingStatus, string> = {
        AUTO_HEALED: 'Auto-Healed',
        PARTIALLY_HEALED: 'Partially Healed',
        NEEDS_MANUAL_REVIEW: 'Needs Manual Review',
        NOT_HEALABLE: 'Not Healable',
    };
    return labels[status];
}

function classification(type: FailureType, category: HealingCategory, rootCause: string, confidence: number): FailureClassification {
    return {
        type,
        failureType: type,
        category,
        isHealable: category === 'HEALABLE',
        confidence,
        rootCause,
        reason: rootCause,
    };
}

function classifyFailure(output: string): FailureClassification {
    const cleanOutput = stripAnsi(output);
    const lower = cleanOutput.toLowerCase();
    if (output.includes(SITE_NAVIGATION_TIMEOUT) || lower.includes('net::err_connection') || lower.includes('site down')) {
        return classification('SITE_DOWN', 'NOT_HEALABLE', 'Application was unreachable from the automation runtime.', 0.95);
    }
    if (lower.includes('net::err_name_not_resolved') || lower.includes('dns')) {
        return classification('DNS_FAILURE', 'NOT_HEALABLE', 'DNS resolution failed.', 0.96);
    }
    if (lower.includes('ssl') || lower.includes('certificate') || lower.includes('net::err_cert')) {
        return classification('SSL_FAILURE', 'NOT_HEALABLE', 'TLS or certificate validation failed.', 0.94);
    }
    if (/\b50\d\b/.test(output) || lower.includes('http 5')) {
        return classification('HTTP_5XX', 'NOT_HEALABLE', 'Server returned a 5xx response.', 0.9);
    }
    if (lower.includes('epic sadface') || lower.includes('authentication') || lower.includes('unauthorized') || lower.includes('invalid credentials')) {
        return classification('AUTHENTICATION_FAILURE', 'NOT_HEALABLE', 'Authentication failed or credentials were rejected.', 0.88);
    }
    if (lower.includes('test data') || lower.includes('csv') || lower.includes('expected at least one')) {
        return classification('INVALID_TEST_DATA', 'NOT_HEALABLE', 'Input data required by the test is invalid or missing.', 0.86);
    }
    if (lower.includes('business') || lower.includes('order complete') || lower.includes('checkout')) {
        return classification('BUSINESS_LOGIC_FAILURE', 'NOT_HEALABLE', 'Failure appears tied to product behavior rather than automation mechanics.', 0.72);
    }
    if (lower.includes('detached') || lower.includes('not attached to the dom')) {
        return classification('ELEMENT_DETACHED', 'HEALABLE', 'Element detached while Playwright was interacting with it.', 0.84);
    }
    if (lower.includes('tohavetext') || lower.includes('expected string') || lower.includes('received string') || (lower.includes('expected:') && lower.includes('received:'))) {
        return classification('TEXT_ASSERTION_MISMATCH', 'HEALABLE', 'Assertion text differs from runtime text.', 0.78);
    }
    if (/timeout:\s*\d{1,3}ms/i.test(cleanOutput)) {
        return classification('TIMING_ISSUE', 'HEALABLE', 'A very short wait or assertion timeout expired before the UI became ready.', 0.82);
    }
    if (lower.includes('waiting for locator(') || /locator\([^)]*\)\.(click|fill|check|selectoption|hover|press):\s*timeout/i.test(cleanOutput)) {
        return classification('LOCATOR_NOT_FOUND', 'HEALABLE', 'Locator could not resolve to a usable element.', 0.9);
    }
    if (lower.includes('not visible') || lower.includes('hidden') || lower.includes('to be visible')) {
        return classification('ELEMENT_HIDDEN', 'HEALABLE', 'Element exists but is not visible at assertion or action time.', 0.82);
    }
    if (lower.includes('expect')) {
        return classification('TEXT_ASSERTION_MISMATCH', 'HEALABLE', 'Assertion text differs from runtime text.', 0.72);
    }
    if (lower.includes('locator') || lower.includes('selector') || lower.includes('strict mode violation')) {
        return classification('LOCATOR_NOT_FOUND', 'HEALABLE', 'Locator could not resolve to a usable element.', 0.84);
    }
    if (lower.includes('tohaveurl') || lower.includes('waitforurl') || lower.includes('navigation')) {
        return classification('NAVIGATION_WAIT_ISSUE', 'HEALABLE', 'Navigation did not reach the expected state within the timeout.', 0.8);
    }
    if (lower.includes('waitfortimeout') || lower.includes('timeout')) {
        return classification('TIMING_ISSUE', 'HEALABLE', 'A wait or action timed out before the UI became ready.', 0.72);
    }
    return classification('UNKNOWN', 'UNKNOWN', 'Failure did not match a known healing pattern.', 0.35);
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

function extractFailedLineNumber(output: string, sourceFile?: string) {
    const clean = stripAnsi(output);
    const normalizedSource = sourceFile ? sourceFile.replace(/\\/g, '/') : '';
    const fileName = sourceFile ? basename(sourceFile) : '';
    const patterns = [
        normalizedSource ? new RegExp(`${normalizedSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+):(\\d+)`) : undefined,
        fileName ? new RegExp(`${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+):(\\d+)`) : undefined,
        /at .*:(\d+):(\d+)/,
    ].filter(Boolean) as RegExp[];
    for (const pattern of patterns) {
        const match = clean.replace(/\\/g, '/').match(pattern);
        if (match?.[1]) return Number(match[1]);
    }
    return undefined;
}

function extractErrorMessage(output: string) {
    const clean = stripAnsi(output).trim();
    const lines = clean.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return lines.find(line => /Error:|TimeoutError|expect\(|locator\(/i.test(line)) || lines[0] || 'Unknown Playwright failure';
}

function extractCurrentUrl(output: string) {
    const clean = stripAnsi(output);
    return clean.match(/https?:\/\/[^\s"'<>),]+/i)?.[0]?.replace(/[.,;:]+$/, '') || PROJECT_BASE_URL;
}

function emptyDomCandidates(url?: string): DomCandidates {
    return {
        url,
        buttons: [],
        inputs: [],
        labels: [],
        placeholders: [],
        links: [],
        headings: [],
        ariaLabels: [],
        testIds: [],
        textCandidates: [],
    };
}

async function collectDomCandidates(url: string | undefined, artifacts: RunArtifacts): Promise<{ candidates: DomCandidates; path: string; count: number }> {
    const domPath = join(artifacts.healingDir, 'dom-candidates.json');
    let candidates = emptyDomCandidates(url);
    try {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url || PROJECT_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        candidates = await page.evaluate(() => {
            const text = (value: string | null | undefined) => String(value || '').replace(/\s+/g, ' ').trim();
            const unique = (items: string[]) => Array.from(new Set(items.map(text).filter(Boolean))).slice(0, 50);
            const attr = (selector: string, name: string) => unique(Array.from(document.querySelectorAll(selector)).map(el => el.getAttribute(name) || ''));
            return {
                url: location.href,
                buttons: unique(Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')).map(el => text(el.textContent) || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '')),
                inputs: unique(Array.from(document.querySelectorAll('input, textarea, select')).map(el => [el.getAttribute('name'), el.getAttribute('id'), el.getAttribute('type')].filter(Boolean).join(':'))),
                labels: unique(Array.from(document.querySelectorAll('label')).map(el => text(el.textContent))),
                placeholders: attr('input[placeholder], textarea[placeholder]', 'placeholder'),
                links: unique(Array.from(document.querySelectorAll('a')).map(el => text(el.textContent) || el.getAttribute('href') || '')),
                headings: unique(Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(el => text(el.textContent))),
                ariaLabels: attr('[aria-label]', 'aria-label'),
                testIds: unique([
                    ...attr('[data-testid]', 'data-testid'),
                    ...attr('[data-test]', 'data-test'),
                    ...attr('[data-qa]', 'data-qa'),
                ]),
                textCandidates: unique(Array.from(document.querySelectorAll('button,a,label,h1,h2,h3,[role="button"],[role="link"]')).map(el => text(el.textContent))),
            };
        });
        await browser.close();
    } catch {
        candidates = emptyDomCandidates(url);
    }
    const count = Object.entries(candidates)
        .filter(([key]) => key !== 'url')
        .reduce((total, [, value]) => total + (Array.isArray(value) ? value.length : 0), 0);
    writeFileSync(domPath, JSON.stringify(candidates, null, 2), 'utf-8');
    return { candidates, path: relative(getProjectRoot(), domPath), count };
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
        const replacement = `await ${pageRef}.waitForLoadState('domcontentloaded');`;
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

function nearbyCode(source: string, failedLine?: number) {
    const lines = source.split(/\r?\n/);
    if (!failedLine) return lines.slice(0, 80).join('\n');
    const start = Math.max(0, failedLine - 12);
    const end = Math.min(lines.length, failedLine + 12);
    return lines.slice(start, end).map((line, index) => `${start + index + 1}: ${line}`).join('\n');
}

function buildAiHealingPrompt(params: {
    failedLocator?: string;
    errorMessage: string;
    testTitle: string;
    nearbyCode: string;
    domCandidates: DomCandidates;
    currentUrl?: string;
}) {
    return [
        'You are TCGen-Buddy Playwright Self-Healing V2.',
        'Return JSON only. Do not include markdown.',
        '',
        'Allowed patch types:',
        '- locator expressions',
        '- wait strategy',
        '- assertion normalization for safe whitespace/casing/dynamic formatting differences',
        '',
        'Forbidden patches:',
        '- test intent',
        '- credentials',
        '- business rules',
        '- expected business outcome',
        '- API endpoint',
        '- test data meaning',
        '',
        'Locator strategy order:',
        '1. data-testid',
        '2. getByRole',
        '3. getByLabel',
        '4. getByPlaceholder',
        '5. getByText',
        '6. aria-label',
        '7. stable CSS selector',
        '',
        'Avoid brittle XPath, dynamic classes, and nth-child unless no other option.',
        '',
        'Return exactly:',
        '{"canHeal":true,"healingType":"locator","originalCode":"...","healedCode":"...","reason":"...","confidence":0.86}',
        '',
        `Failed locator: ${params.failedLocator || 'Not detected'}`,
        `Error message: ${params.errorMessage}`,
        `Test title: ${params.testTitle}`,
        `Current URL: ${params.currentUrl || 'Unknown'}`,
        '',
        'Nearby code:',
        params.nearbyCode,
        '',
        'DOM candidates:',
        JSON.stringify(params.domCandidates, null, 2),
    ].join('\n');
}

function parseAiHealingSuggestion(content: string): AiHealingSuggestion | undefined {
    const trimmed = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    try {
        const parsed = JSON.parse(trimmed) as Partial<AiHealingSuggestion>;
        if (
            typeof parsed.canHeal === 'boolean' &&
            ['locator', 'wait', 'assertion'].includes(String(parsed.healingType)) &&
            typeof parsed.originalCode === 'string' &&
            typeof parsed.healedCode === 'string' &&
            typeof parsed.reason === 'string' &&
            typeof parsed.confidence === 'number'
        ) {
            return parsed as AiHealingSuggestion;
        }
    } catch {}
    return undefined;
}

function applyAiSuggestion(source: string, suggestion: AiHealingSuggestion | undefined, changes: HealingChange[]) {
    if (!suggestion?.canHeal || suggestion.confidence < 0.7) return source;
    if (!suggestion.originalCode.trim() || !suggestion.healedCode.trim()) return source;
    const next = source.replace(suggestion.originalCode, suggestion.healedCode);
    if (next !== source) {
        changes.push({
            kind: suggestion.healingType,
            original: suggestion.originalCode,
            replacement: suggestion.healedCode,
            reason: `AI-assisted healing: ${suggestion.reason}`,
        });
    }
    return next;
}

async function requestAiHealingSuggestion(params: {
    source: string;
    evidence: HealingEvidence;
    domCandidates: DomCandidates;
    provider: AiProviderId;
    model?: string;
    providerSettings?: ProviderSettings;
    artifacts: RunArtifacts;
}) {
    const prompt = buildAiHealingPrompt({
        failedLocator: params.evidence.failedLocator,
        errorMessage: params.evidence.errorMessage,
        testTitle: params.evidence.testTitle,
        nearbyCode: nearbyCode(params.source, params.evidence.failedLineNumber),
        domCandidates: params.domCandidates,
        currentUrl: params.evidence.currentUrl,
    });
    const promptPath = join(params.artifacts.healingDir, 'ai-healing-prompt.txt');
    writeFileSync(promptPath, prompt, 'utf-8');
    const result = await aiProviderOrchestrator.generate(params.provider, {
        prompt,
        model: params.model,
        settings: params.providerSettings,
        responseFormat: 'json',
        temperature: 0,
        maxTokens: 1200,
    });
    return {
        suggestion: parseAiHealingSuggestion(result.content),
        promptPath: relative(getProjectRoot(), promptPath),
    };
}

function createHealedScript(params: {
    artifacts: RunArtifacts;
    sourceCode?: string;
    sourceFile?: string;
    classification: FailureClassification;
    output: string;
    failedLocator?: string;
    evidence: HealingEvidence;
    aiSuggestion?: AiHealingSuggestion;
}) {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const changes: HealingChange[] = [];
    const source = params.sourceCode ?? (params.sourceFile && existsSync(params.sourceFile) ? readFileSync(params.sourceFile, 'utf-8') : '');
    if (!source.trim()) return { changes, healedScriptPath: undefined };

    let healed = applyAiSuggestion(source, params.aiSuggestion, changes);
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
    const sourceName = sanitizeFilePart(basename(params.sourceFile || 'generated.spec.ts').replace(/\.spec\.ts$/i, ''));
    const healedDir = join(automationDir, 'scripts', 'healed', params.artifacts.runId);
    const healedScriptPath = join(healedDir, `${sourceName}.healed.spec.ts`);
    mkdirSync(healedDir, { recursive: true });
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
    sourceFile?: string;
    browser: BrowserName;
    suite: string;
}) {
    const rootDir = getProjectRoot();
    const evidenceDir = join(params.artifacts.healingDir, 'evidence');
    const errorStackPath = join(params.artifacts.healingDir, 'error-stack.txt');
    const evidenceJsonFullPath = join(params.artifacts.healingDir, 'evidence.json');
    mkdirSync(params.artifacts.healingDir, { recursive: true });
    const stackTrace = `${params.result.output || ''}\n${params.result.stderr || ''}`.trim();
    writeFileSync(errorStackPath, stackTrace, 'utf-8');

    const searchRoots = [params.artifacts.tracesDir, params.artifacts.playwrightHtmlDir];
    const screenshots = copyEvidenceFiles(searchRoots.flatMap(dir => collectArtifactFiles(dir, ['.png'])).slice(0, 10), evidenceDir);
    const traces = copyEvidenceFiles(searchRoots.flatMap(dir => collectArtifactFiles(dir, ['.zip'])).slice(0, 10), evidenceDir);
    const videos = copyEvidenceFiles(searchRoots.flatMap(dir => collectArtifactFiles(dir, ['.webm'])).slice(0, 10), evidenceDir);
    const output = `${params.result.output || ''}\n${params.result.stderr || ''}`;
    const testTitles = extractFailedTestTitles(params.result, params.failedTests);
    const evidence: HealingEvidence = {
        testTitle: testTitles[0] || 'Unknown failed test',
        specFilePath: params.sourceFile ? relative(rootDir, params.sourceFile) : undefined,
        failedLineNumber: extractFailedLineNumber(output, params.sourceFile),
        errorMessage: extractErrorMessage(output),
        stackTrace,
        screenshotPath: screenshots[0] ? relative(rootDir, screenshots[0]) : undefined,
        tracePath: traces[0] ? relative(rootDir, traces[0]) : undefined,
        videoPath: videos[0] ? relative(rootDir, videos[0]) : undefined,
        currentUrl: extractCurrentUrl(output),
        browser: params.browser,
        suite: params.suite,
        runId: params.artifacts.runId,
        screenshots: screenshots.map(file => relative(rootDir, file)),
        traces: traces.map(file => relative(rootDir, file)),
        videos: videos.map(file => relative(rootDir, file)),
        errorStackPath: relative(rootDir, errorStackPath),
        evidenceJsonPath: relative(rootDir, evidenceJsonFullPath),
        testTitles,
        failedLocator: extractFailedLocator(output),
    };
    writeFileSync(evidenceJsonFullPath, JSON.stringify(evidence, null, 2), 'utf-8');
    return evidence;
}

function writeHealingReport(params: {
    artifacts: RunArtifacts;
    attempt: HealingAttemptResult;
}) {
    const attempt = params.attempt;
    const firstChange = attempt.changes[0];
    const report = [
        `# Healing Report - ${params.artifacts.runId}`,
        '',
        `Run ID: ${params.artifacts.runId}`,
        `Suite: ${attempt.evidence.suite}`,
        `Failed Test: ${attempt.evidence.testTitle}`,
        `Final Status: ${attempt.finalStatus}`,
        `Failure Type: ${attempt.classification.type}`,
        `Healable: ${attempt.classification.isHealable ? 'Yes' : 'No'}`,
        `Confidence: ${attempt.confidence.toFixed(2)}`,
        `Reason: ${attempt.reason}`,
        '',
        '## Failed Tests',
        ...(attempt.evidence.testTitles.length ? attempt.evidence.testTitles.map(test => `- ${test}`) : ['- Unknown failed test']),
        '',
        '## Evidence',
        `- Evidence JSON: ${attempt.evidence.evidenceJsonPath}`,
        `- Error Stack: ${attempt.evidence.errorStackPath}`,
        `- Screenshots: ${attempt.evidence.screenshots.join(', ') || 'Not captured'}`,
        `- Traces: ${attempt.evidence.traces.join(', ') || 'Not captured'}`,
        `- Videos: ${attempt.evidence.videos.join(', ') || 'Not captured'}`,
        `- Failed Locator: ${attempt.evidence.failedLocator || 'Not detected'}`,
        `- Current URL: ${attempt.evidence.currentUrl || 'Unknown'}`,
        `- Browser: ${attempt.evidence.browser}`,
        `- DOM Candidates: ${attempt.domCandidatesPath || 'Not collected'} (${attempt.domCandidateCount ?? 0})`,
        attempt.aiPromptPath ? `- AI Prompt: ${attempt.aiPromptPath}` : '- AI Prompt: Not used',
        '',
        '## Locator Healing',
        `- Original Locator: ${attempt.originalLocator || 'Not applicable'}`,
        `- Replacement Locator: ${attempt.replacementLocator || 'Not applicable'}`,
        '',
        '## Original Code',
        '```ts',
        firstChange?.original || 'Not applicable',
        '```',
        '',
        '## Healed Code',
        '```ts',
        firstChange?.replacement || 'Not applicable',
        '```',
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
        '',
        '## Manual Review Notes',
        attempt.finalStatus === 'NEEDS_MANUAL_REVIEW'
            ? '- Review the failed locator, DOM candidates, trace, and suggested patch before applying to source.'
            : '- No manual review notes.',
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
    suite: string;
    headed: boolean;
    browser: BrowserName;
    incognito?: boolean;
    aiProvider: AiProviderId;
    aiModel?: string;
    providerSettings?: ProviderSettings;
    linkedStoryId?: string;
    log: (message: string) => void | Promise<void>;
}): Promise<HealingAttemptResult> {
    const output = `${params.result.output || ''}\n${params.result.stderr || ''}`;
    const classification = classifyFailure(output);
    const evidence = collectHealingEvidence({
        artifacts: params.artifacts,
        result: params.result,
        failedTests: params.failedTests,
        sourceFile: params.sourceFile,
        browser: params.browser,
        suite: params.suite,
    });
    await params.log(`[Healing] Failure classified: ${classification.type}`);

    const baseAttempt: HealingAttemptResult = {
        attempted: false,
        finalStatus: classification.category === 'NOT_HEALABLE' ? 'NOT_HEALABLE' : 'NEEDS_MANUAL_REVIEW',
        classification,
        evidence,
        changes: [],
        originalLocator: evidence.failedLocator,
        confidence: classification.confidence,
        reason: classification.reason,
    };

    if (classification.category !== 'HEALABLE') {
        await params.log(`[Healing] Not healable: ${classification.rootCause}`);
        baseAttempt.memoryVaultEvent = {
            sourceType: 'self_healing_event',
            runId: params.artifacts.runId,
            suite: params.suite,
            testTitle: evidence.testTitle,
            failureType: classification.type,
            originalLocator: evidence.failedLocator,
            finalStatus: baseAttempt.finalStatus,
            confidence: classification.confidence,
            linkedAutomationRunId: params.artifacts.runId,
            linkedStoryId: params.linkedStoryId,
            createdAt: new Date().toISOString(),
        };
        writeHealingReport({ artifacts: params.artifacts, attempt: baseAttempt });
        return baseAttempt;
    }

    await params.log('[Healing] Healing started');
    if (classification.type === 'LOCATOR_NOT_FOUND') await params.log('[Healing] Locator failure detected');
    const dom = await collectDomCandidates(evidence.currentUrl, params.artifacts);
    await params.log(`[Healing] DOM candidates collected: ${dom.count}`);

    let aiSuggestion: AiHealingSuggestion | undefined;
    let aiPromptPath: string | undefined;
    const source = params.sourceCode ?? (params.sourceFile && existsSync(params.sourceFile) ? readFileSync(params.sourceFile, 'utf-8') : '');
    if (source.trim()) {
        try {
            const ai = await requestAiHealingSuggestion({
                source,
                evidence,
                domCandidates: dom.candidates,
                provider: params.aiProvider,
                model: params.aiModel,
                providerSettings: params.providerSettings,
                artifacts: params.artifacts,
            });
            aiSuggestion = ai.suggestion;
            aiPromptPath = ai.promptPath;
            if (aiSuggestion?.canHeal) {
                await params.log('[Healing] AI suggested replacement locator');
            } else {
                await params.log('[Healing] AI did not return a safe healing suggestion');
            }
        } catch (error) {
            await params.log(`[Healing] AI-assisted healing unavailable: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    if (aiSuggestion?.canHeal && aiSuggestion.confidence < 0.7) {
        const lowConfidenceAttempt: HealingAttemptResult = {
            ...baseAttempt,
            finalStatus: 'NEEDS_MANUAL_REVIEW',
            attempted: true,
            changes: [],
            confidence: aiSuggestion.confidence,
            reason: `AI confidence below auto-apply threshold: ${aiSuggestion.reason}`,
            domCandidatesPath: dom.path,
            domCandidateCount: dom.count,
            aiSuggestion,
            aiPromptPath,
            memoryVaultEvent: {
                sourceType: 'self_healing_event',
                runId: params.artifacts.runId,
                suite: params.suite,
                testTitle: evidence.testTitle,
                failureType: classification.type,
                originalLocator: evidence.failedLocator,
                finalStatus: 'NEEDS_MANUAL_REVIEW',
                confidence: aiSuggestion.confidence,
                linkedAutomationRunId: params.artifacts.runId,
                linkedStoryId: params.linkedStoryId,
                createdAt: new Date().toISOString(),
            },
        };
        await params.log('[Healing] Needs Manual Review');
        writeHealingReport({ artifacts: params.artifacts, attempt: lowConfidenceAttempt });
        return lowConfidenceAttempt;
    }

    const created = createHealedScript({
        artifacts: params.artifacts,
        sourceCode: params.sourceCode,
        sourceFile: params.sourceFile,
        classification,
        output,
        failedLocator: evidence.failedLocator,
        evidence,
        aiSuggestion,
    });

    const attempt: HealingAttemptResult = {
        ...baseAttempt,
        attempted: true,
        healedScriptPath: created.healedScriptPath,
        changes: created.changes,
        replacementLocator: created.changes.find(change => change.kind === 'locator')?.replacement,
        confidence: Math.max(classification.confidence, aiSuggestion?.confidence || 0),
        reason: aiSuggestion?.reason || classification.reason,
        domCandidatesPath: dom.path,
        domCandidateCount: dom.count,
        aiSuggestion,
        aiPromptPath,
    };

    if (!created.healedScriptPath || created.changes.length === 0) {
        attempt.finalStatus = 'NEEDS_MANUAL_REVIEW';
        attempt.error = 'No safe automatic code change was available.';
        await params.log('[Healing] No safe automatic code change was available');
        attempt.memoryVaultEvent = {
            sourceType: 'self_healing_event',
            runId: params.artifacts.runId,
            suite: params.suite,
            testTitle: evidence.testTitle,
            failureType: classification.type,
            originalLocator: evidence.failedLocator,
            finalStatus: attempt.finalStatus,
            confidence: attempt.confidence,
            linkedAutomationRunId: params.artifacts.runId,
            linkedStoryId: params.linkedStoryId,
            healedScriptPath: created.healedScriptPath,
            createdAt: new Date().toISOString(),
        };
        writeHealingReport({ artifacts: params.artifacts, attempt });
        return attempt;
    }

    for (const change of created.changes) {
        await params.log(`[Healing] ${change.kind === 'locator' ? 'Locator healed' : change.kind === 'wait' ? 'Wait healed' : 'Assertion healed'}: ${change.original} -> ${change.replacement}`);
    }
    await params.log('[Healing] Healed script saved');

    const grep = buildFailedOnlyGrep(evidence.testTitles);
    attempt.failedOnlyGrep = grep;
    for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber += 1) {
        await params.log(`[Healing] Re-running failed test (attempt ${attemptNumber}/3)`);
        const rerun = await runHealedScript(created.healedScriptPath, grep, params.artifacts, {
            headed: params.headed,
            browser: params.browser,
            incognito: params.incognito,
        });
        attempt.rerunResult = rerun;
        if (rerun.success) {
            attempt.finalStatus = 'AUTO_HEALED';
            attempt.memoryVaultEvent = {
                sourceType: 'self_healing_event',
                runId: params.artifacts.runId,
                suite: params.suite,
                testTitle: evidence.testTitle,
                failureType: classification.type,
                originalLocator: evidence.failedLocator,
                healedLocator: attempt.replacementLocator,
                finalStatus: attempt.finalStatus,
                confidence: attempt.confidence,
                linkedAutomationRunId: params.artifacts.runId,
                linkedStoryId: params.linkedStoryId,
                healedScriptPath: created.healedScriptPath,
                createdAt: new Date().toISOString(),
            };
            await params.log('[Healing] Auto-Healed');
            writeHealingReport({ artifacts: params.artifacts, attempt });
            return attempt;
        }
        await params.log('[Healing] Re-run failed');
    }

    attempt.finalStatus = created.changes.length > 0 ? 'PARTIALLY_HEALED' : 'NEEDS_MANUAL_REVIEW';
    attempt.memoryVaultEvent = {
        sourceType: 'self_healing_event',
        runId: params.artifacts.runId,
        suite: params.suite,
        testTitle: evidence.testTitle,
        failureType: classification.type,
        originalLocator: evidence.failedLocator,
        healedLocator: attempt.replacementLocator,
        finalStatus: attempt.finalStatus,
        confidence: attempt.confidence,
        linkedAutomationRunId: params.artifacts.runId,
        linkedStoryId: params.linkedStoryId,
        healedScriptPath: created.healedScriptPath,
        createdAt: new Date().toISOString(),
    };
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
