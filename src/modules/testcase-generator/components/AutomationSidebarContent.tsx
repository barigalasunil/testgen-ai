"use client";

import { useEffect, useRef, useState } from 'react';
import {
    AlertCircle,
    BarChart3,
    CheckCircle2,
    Clock3,
    Copy,
    Download,
    ExternalLink,
    FileText,
    Play,
    ShieldCheck,
    Terminal,
    Wrench,
    Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutomationExecutionSummary, AutomationRunRecord, SuiteExecution, SuiteKey } from '../types';

interface AutomationSidebarContentProps {
    automation: Record<SuiteKey, SuiteExecution>;
    onExecuteSuite: (suite: SuiteKey, headed: boolean) => void;
    scriptCode: string | null;
    hasTestCases: boolean;
    onGenerateScript: () => void;
    onRunAutomation: () => void;
    isGeneratingScript: boolean;
    isRunningAutomation: boolean;
    anySuiteRunning?: boolean;
    executionLogs: string[];
    executionSummary: AutomationExecutionSummary | null;
    passedTests: string[];
    failedTests: string[];
    headed: boolean;
    onHeadedChange: (val: boolean) => void;
    reportUrl: string | null;
    automationRuns?: AutomationRunRecord[];
    automationToast?: {
        type: 'success' | 'failed' | 'error' | 'warning' | 'partial_success';
        message: string;
        reportUrl?: string | null;
        persistent: boolean;
    } | null;
    onCloseToast?: () => void;
    onCopyScript?: () => void;
    onDownloadScript?: () => void;
    platformType?: string;
}

function formatDuration(ms?: number) {
    if (!ms) return 'Not run';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(timestamp?: string) {
    if (!timestamp) return 'Never run';
    return new Date(timestamp).toLocaleString();
}

function formatSuiteStatus(status: SuiteExecution['status']) {
    if (status === 'completed') return 'Passed';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function suiteStatusClass(status: SuiteExecution['status']) {
    if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/30';
    if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/30';
    if (status === 'running') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-900/30';
    return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700';
}

function Card({
    title,
    description,
    status,
    children,
}: {
    title: string;
    description: string;
    status?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-4 min-h-[68px]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
                {status && <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-500">{status}</p>}
            </div>
            {children}
        </section>
    );
}

function ReportButtons({
    playwrightUrl,
    allureUrl,
    healingUrl,
    compact = false,
}: {
    playwrightUrl?: string | null;
    allureUrl?: string | null;
    healingUrl?: string | null;
    compact?: boolean;
}) {
    const buttonClass = compact
        ? 'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
        : 'inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';

    return (
        <div className={cn('grid gap-2', compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1')}>
            {playwrightUrl && (
                <a href={playwrightUrl} target="_blank" rel="noreferrer" className={buttonClass}>
                    <FileText className="h-4 w-4" />
                    Playwright
                </a>
            )}
            {allureUrl && (
                <a href={allureUrl} target="_blank" rel="noreferrer" className={buttonClass}>
                    <BarChart3 className="h-4 w-4" />
                    Allure
                </a>
            )}
            {healingUrl && (
                <a href={healingUrl} target="_blank" rel="noreferrer" className={buttonClass}>
                    <Wrench className="h-4 w-4" />
                    Healing
                </a>
            )}
        </div>
    );
}

const suites: { key: SuiteKey; name: string; description: string; cta: string }[] = [
    { key: 'smoke', name: 'Smoke Suite', description: 'Run critical high-priority validation tests.', cta: 'Run Smoke' },
    { key: 'sanity', name: 'Sanity Suite', description: 'Run key functional validation tests.', cta: 'Run Sanity' },
    { key: 'regression', name: 'Regression Suite', description: 'Run full regression validation suite.', cta: 'Run Regression' },
];

export function AutomationSidebarContent({
    automation,
    onExecuteSuite,
    scriptCode,
    hasTestCases,
    onGenerateScript,
    onRunAutomation,
    isGeneratingScript,
    isRunningAutomation,
    anySuiteRunning = false,
    executionLogs,
    executionSummary,
    passedTests,
    failedTests,
    headed,
    onHeadedChange,
    reportUrl,
    automationRuns = [],
    automationToast,
    onCloseToast,
    onCopyScript,
    onDownloadScript,
}: AutomationSidebarContentProps) {
    const hasScript = Boolean(scriptCode);
    const [showReportsPanel, setShowReportsPanel] = useState(false);
    const [logCopyToast, setLogCopyToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const logsRef = useRef<HTMLDivElement>(null);

    const latestPlaywrightUrl = executionSummary?.playwrightReportUrl || executionSummary?.reportUrl || reportUrl || null;
    const latestAllureUrl = executionSummary?.allureReportUrl || null;
    const latestHealingUrl = executionSummary?.healingReportUrl || null;
    const latestLogUrl = executionSummary?.logUrl || null;
    const resolvedReportUrl = latestPlaywrightUrl;
    const hasResults = Boolean(executionSummary);
    const displayLogs = executionLogs;
    const reportRuns: AutomationRunRecord[] = automationRuns;

    useEffect(() => {
        logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' });
    }, [displayLogs]);

    const showLogToast = (type: 'success' | 'error', message: string) => {
        setLogCopyToast({ type, message });
        window.setTimeout(() => setLogCopyToast(null), 3200);
    };

    const copyExecutionLogs = async () => {
        try {
            await navigator.clipboard.writeText(displayLogs.join('\n'));
            showLogToast('success', 'Execution logs copied');
        } catch {
            showLogToast('error', 'Unable to copy logs');
        }
    };

    return (
        <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Automation</p>
                        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Automation Dashboard</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                            Run generated or existing Playwright automation suites, view execution reports, and heal failing tests automatically.
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                        <Workflow className="h-4 w-4 text-[#10A37F]" />
                        Test Cases {'->'} Script {'->'} Execution {'->'} Reports {'->'} Healing {'->'} Defects
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Suite Execution Grid</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Run suites and open their Playwright, Allure, or healing reports.</p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <input type="checkbox" checked={headed} onChange={(event) => onHeadedChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800" />
                        Headed run
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {suites.map((suite) => {
                        const state = automation[suite.key];
                        const isThisSuiteRunning = state.status === 'running';
                        const anotherSuiteRunning = anySuiteRunning && !isThisSuiteRunning;
                        const suiteDisabled = isThisSuiteRunning || anySuiteRunning;

                        return (
                            <article key={suite.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50">
                                <div className="flex min-h-[92px] flex-col justify-between gap-3">
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{suite.name}</h3>
                                            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', suiteStatusClass(state.status))}>{formatSuiteStatus(state.status)}</span>
                                        </div>
                                        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{suite.description}</p>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        <span>Last run: {formatTimestamp(state.lastRunAt)}</span>
                                    </div>
                                    {state.durationMs !== undefined && <div>Duration: {formatDuration(state.durationMs)}</div>}
                                    {state.runId && <div className="truncate">Run ID: {state.runId}</div>}
                                    {state.status === 'failed' && state.message && (
                                        <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">{state.message}</div>
                                    )}
                                </div>
                                <div className="mt-4 space-y-2">
                                    {anotherSuiteRunning && (
                                        <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400">
                                            Automation already running
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => onExecuteSuite(suite.key, headed)}
                                        disabled={suiteDisabled}
                                        className={cn(
                                            'inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition',
                                            suiteDisabled
                                                ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                                                : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-[#10A37F] dark:hover:bg-[#10A37F]/90'
                                        )}
                                    >
                                        {isThisSuiteRunning ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Play className="h-4 w-4" />}
                                        {isThisSuiteRunning ? 'Running...' : anotherSuiteRunning ? 'Waiting...' : suite.cta}
                                    </button>
                                    <ReportButtons playwrightUrl={state.playwrightReportUrl || state.reportUrl} allureUrl={state.allureReportUrl} healingUrl={state.healingReportUrl} compact />
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card title="Generated Script Run" description={hasScript ? 'Execute the generated Playwright script.' : 'Generate script before running automation.'} status={isRunningAutomation ? 'Running' : hasScript ? 'Ready to run' : 'Disabled'}>
                    <button
                        type="button"
                        onClick={onRunAutomation}
                        disabled={!hasScript || isRunningAutomation}
                        className={cn(
                            'inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition',
                            hasScript && !isRunningAutomation
                                ? 'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500'
                                : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                        )}
                    >
                        {isRunningAutomation ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Play className="h-4 w-4" />}
                        {isRunningAutomation ? 'Running...' : 'Run Generated Script'}
                    </button>
                </Card>

                <Card title="Generate Script" description={hasTestCases ? 'Create a Playwright script from the active test case table.' : 'Generate test cases first, then create a script.'} status={hasScript ? 'Script ready' : 'No script generated yet'}>
                    <button
                        type="button"
                        onClick={onGenerateScript}
                        disabled={!hasTestCases || isGeneratingScript}
                        className={cn(
                            'inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition',
                            hasTestCases && !isGeneratingScript
                                ? 'bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600'
                                : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                        )}
                    >
                        {isGeneratingScript ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        {isGeneratingScript ? 'Generating...' : 'Generate Script'}
                    </button>
                </Card>

                <Card title="Reports" description={resolvedReportUrl || latestAllureUrl ? 'Open the latest execution reports.' : 'No execution report available yet.'} status={resolvedReportUrl || latestAllureUrl ? 'Report available' : 'No report'}>
                    <button
                        type="button"
                        onClick={() => setShowReportsPanel(current => !current)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                    >
                        <FileText className="h-4 w-4" />
                        {showReportsPanel ? 'Hide Reports' : 'Open Reports Panel'}
                    </button>
                </Card>

                <Card title="Healing Center" description={latestHealingUrl ? 'Open the latest self-healing evidence report.' : 'Healing report appears after a run.'} status={latestHealingUrl ? 'Healing report available' : 'No healing report'}>
                    {latestHealingUrl ? (
                        <a href={latestHealingUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
                            <Wrench className="h-4 w-4" />
                            Open Healing Report
                        </a>
                    ) : (
                        <button type="button" disabled className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400 dark:bg-slate-800 dark:text-slate-600">
                            <Wrench className="h-4 w-4" />
                            Healing Pending
                        </button>
                    )}
                </Card>

                <Card title="Download Script" description={hasScript ? 'Download or copy the generated Playwright script.' : 'No script generated yet.'} status={hasScript ? 'Download enabled' : 'Download disabled'}>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={onDownloadScript}
                            disabled={!hasScript || !onDownloadScript}
                            className={cn('inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition', hasScript ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600' : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600')}
                        >
                            <Download className="h-4 w-4" />
                            Download
                        </button>
                        <button
                            type="button"
                            onClick={onCopyScript}
                            disabled={!hasScript || !onCopyScript}
                            className={cn('inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold transition dark:border-slate-700 dark:bg-slate-800', hasScript ? 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700' : 'cursor-not-allowed text-slate-400 dark:text-slate-600')}
                        >
                            <Copy className="h-4 w-4" />
                            Copy
                        </button>
                    </div>
                </Card>

                <Card title="View Results" description={hasResults ? 'Review the latest execution summary.' : 'Run automation to view results.'} status={hasResults ? `Duration: ${formatDuration(executionSummary?.durationMs)}` : 'No results'}>
                    {executionSummary ? (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-800">
                                <div className="font-bold text-slate-900 dark:text-slate-100">{executionSummary.total}</div>
                                <div className="text-slate-500 dark:text-slate-500">Total</div>
                            </div>
                            <div className="rounded-md bg-emerald-50 p-2 dark:bg-emerald-900/10">
                                <div className="font-bold text-emerald-700 dark:text-emerald-400">{executionSummary.passed}</div>
                                <div className="text-emerald-700 dark:text-emerald-400">Passed</div>
                            </div>
                            <div className="rounded-md bg-red-50 p-2 dark:bg-red-900/10">
                                <div className="font-bold text-red-700 dark:text-red-400">{executionSummary.failed}</div>
                                <div className="text-red-700 dark:text-red-400">Failed</div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-500">
                            <AlertCircle className="h-4 w-4" />
                            No results yet
                        </div>
                    )}
                    {(passedTests.length > 0 || failedTests.length > 0) && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            {passedTests.length} passed
                            <Terminal className="ml-2 h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            {failedTests.length} failed
                        </div>
                    )}
                    {executionSummary?.runId && (
                        <a href={executionSummary.playwrightReportUrl || executionSummary.reportUrl || '#'} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#10A37F]">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {executionSummary.runId}
                        </a>
                    )}
                </Card>
            </div>

            {showReportsPanel && (
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reports Panel</h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest and previous automation run reports stay inside Automation Hub.</p>
                        </div>
                        <button type="button" onClick={() => setShowReportsPanel(false)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                            Close
                        </button>
                    </div>
                    <div className="space-y-3">
                        {reportRuns.length ? reportRuns.map((run) => (
                            <article key={run.runId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                <div className="grid gap-2 text-xs text-slate-600 dark:text-slate-400 md:grid-cols-4">
                                    <div><span className="font-semibold text-slate-900 dark:text-slate-100">Run ID:</span> {run.runId}</div>
                                    <div><span className="font-semibold text-slate-900 dark:text-slate-100">Suite:</span> {run.suite || 'Generated Script'}</div>
                                    <div><span className="font-semibold text-slate-900 dark:text-slate-100">Browser:</span> {run.browser || 'chromium'}</div>
                                    <div><span className="font-semibold text-slate-900 dark:text-slate-100">Mode:</span> {run.mode || 'Headless'}</div>
                                    <div className="md:col-span-2"><span className="font-semibold text-slate-900 dark:text-slate-100">Target URL:</span> {run.targetUrl || 'Not Provided'}</div>
                                    <div><span className="font-semibold text-slate-900 dark:text-slate-100">Status:</span> {run.status}</div>
                                    <div><span className="font-semibold text-slate-900 dark:text-slate-100">Duration:</span> {formatDuration(run.durationMs)}</div>
                                    <div><span className="font-semibold text-slate-900 dark:text-slate-100">Start:</span> {formatTimestamp(run.startedAt)}</div>
                                    <div><span className="font-semibold text-slate-900 dark:text-slate-100">End:</span> {formatTimestamp(run.finishedAt)}</div>
                                    <div><span className="font-semibold text-slate-900 dark:text-slate-100">Passed:</span> {run.passed ?? 0}</div>
                                    <div><span className="font-semibold text-slate-900 dark:text-slate-100">Failed:</span> {run.failed ?? 0}</div>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                    {run.playwrightReportUrl ? (
                                        <a href={run.playwrightReportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><FileText className="h-4 w-4" /> Open Playwright HTML Report</a>
                                    ) : (
                                        <div className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400 dark:border-slate-800">Report not generated</div>
                                    )}
                                    {run.allureReportUrl ? (
                                        <a href={run.allureReportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><BarChart3 className="h-4 w-4" /> Open Allure Report</a>
                                    ) : (
                                        <div className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400 dark:border-slate-800">Allure report not generated</div>
                                    )}
                                    {run.logUrl ? (
                                        <a href={run.logUrl} download className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Download className="h-4 w-4" /> Download Logs</a>
                                    ) : (
                                        <div className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400 dark:border-slate-800">No logs captured</div>
                                    )}
                                </div>
                            </article>
                        )) : (
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">No automation reports yet.</div>
                        )}
                    </div>
                </section>
            )}

            <section id="automation-execution-logs" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Execution Logs</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Live automation output, report generation status, and healing analysis.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-500">{displayLogs.length} line{displayLogs.length === 1 ? '' : 's'}</span>
                        <button
                            type="button"
                            onClick={copyExecutionLogs}
                            disabled={!displayLogs.length}
                            className={cn(
                                'inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition',
                                displayLogs.length
                                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                    : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                            )}
                        >
                            <Copy className="h-3.5 w-3.5" />
                            Copy Logs
                        </button>
                        {latestLogUrl && (
                            <a href={latestLogUrl} download className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                                <Download className="h-3.5 w-3.5" />
                                Download Logs
                            </a>
                        )}
                    </div>
                </div>
                <div ref={logsRef} className="h-[420px] overflow-y-auto rounded-md border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200 shadow-inner">
                    {displayLogs.length ? displayLogs.map((log, index) => {
                        const lower = log.toLowerCase();
                        const color = lower.includes('error') || lower.includes('failed')
                            ? 'text-red-300'
                            : lower.includes('warning') || lower.includes('partial')
                                ? 'text-amber-300'
                                : lower.includes('passed') || lower.includes('success')
                                    ? 'text-emerald-300'
                                    : 'text-slate-200';
                        return <div className={color} key={`${index}-${log.slice(0, 16)}`}>{log}</div>;
                    }) : (
                        <div className="flex h-full items-center text-slate-500">No execution logs yet</div>
                    )}
                </div>
            </section>

            {automationToast && (
                <div className={cn(
                    'fixed bottom-5 right-5 z-50 max-w-md rounded-lg border px-4 py-3 shadow-xl',
                    automationToast.type === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900 dark:text-emerald-100',
                    automationToast.type === 'partial_success' && 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900 dark:text-amber-100',
                    (automationToast.type === 'failed' || automationToast.type === 'error') && 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-900 dark:text-red-100',
                    automationToast.type === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900 dark:text-amber-100'
                )}>
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1 text-sm font-semibold">
                            {automationToast.message}
                            {automationToast.reportUrl && (
                                <a href={automationToast.reportUrl} target="_blank" rel="noreferrer" className="ml-2 underline">
                                    Open report
                                </a>
                            )}
                        </div>
                        <button type="button" onClick={onCloseToast} className="rounded-md px-2 py-1 text-xs font-bold hover:bg-black/10">
                            Close
                        </button>
                    </div>
                </div>
            )}
            {logCopyToast && (
                <div className={cn(
                    'fixed bottom-5 left-5 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm font-semibold shadow-xl',
                    logCopyToast.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900 dark:text-emerald-100'
                        : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-900 dark:text-red-100'
                )}>
                    {logCopyToast.message}
                </div>
            )}
        </div>
    );
}
