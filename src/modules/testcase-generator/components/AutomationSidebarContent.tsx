"use client";

import { AlertCircle, CheckCircle2, Copy, Download, FileText, Play, ShieldCheck, TerminalSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SuiteExecution, SuiteKey } from '../types';

interface AutomationSidebarContentProps {
    automation: Record<SuiteKey, SuiteExecution>;
    onExecuteSuite: (suite: SuiteKey, headed: boolean) => void;
    scriptCode: string | null;
    hasTestCases: boolean;
    onGenerateScript: () => void;
    onRunAutomation: () => void;
    isGeneratingScript: boolean;
    isRunningAutomation: boolean;
    executionLogs: string[];
    executionSummary: { total: number; passed: number; failed: number; durationMs: number; reportUrl?: string } | null;
    passedTests: string[];
    failedTests: string[];
    headed: boolean;
    onHeadedChange: (val: boolean) => void;
    reportUrl: string | null;
    onCopyScript?: () => void;
    onDownloadScript?: () => void;
    platformType?: string;
}

function formatDuration(ms?: number) {
    if (!ms) return 'Not run';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
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
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 min-h-[68px]">
                <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                {status && <p className="mt-2 text-[11px] font-semibold text-slate-500">{status}</p>}
            </div>
            {children}
        </section>
    );
}

export function AutomationSidebarContent({
    scriptCode,
    hasTestCases,
    onGenerateScript,
    onRunAutomation,
    isGeneratingScript,
    isRunningAutomation,
    executionLogs,
    executionSummary,
    passedTests,
    failedTests,
    reportUrl,
    onCopyScript,
    onDownloadScript,
}: AutomationSidebarContentProps) {
    const hasScript = Boolean(scriptCode);
    const resolvedReportUrl = reportUrl || executionSummary?.reportUrl || null;
    const hasResults = Boolean(executionSummary);

    return (
        <div className="space-y-4">
            <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400 font-semibold">Automation</p>
                <h1 className="mt-1 text-xl font-semibold text-slate-900">Automation Dashboard</h1>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card
                    title="Generate Script"
                    description={hasTestCases ? 'Create a Playwright script from the active test case table.' : 'Generate test cases first, then create a script.'}
                    status={hasScript ? 'Script ready' : 'No script generated yet'}
                >
                    <button
                        type="button"
                        onClick={onGenerateScript}
                        disabled={!hasTestCases || isGeneratingScript}
                        className={cn(
                            'inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition',
                            hasTestCases && !isGeneratingScript
                                ? 'bg-violet-600 text-white hover:bg-violet-700'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        )}
                    >
                        {isGeneratingScript ? (
                            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        ) : (
                            <ShieldCheck className="h-4 w-4" />
                        )}
                        {isGeneratingScript ? 'Generating...' : 'Generate Script'}
                    </button>
                </Card>

                <Card
                    title="Run Automation"
                    description={hasScript ? 'Execute the generated Playwright script.' : 'Generate script before running automation.'}
                    status={isRunningAutomation ? 'Running' : hasScript ? 'Ready to run' : 'Disabled'}
                >
                    <button
                        type="button"
                        onClick={onRunAutomation}
                        disabled={!hasScript || isRunningAutomation}
                        className={cn(
                            'inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition',
                            hasScript && !isRunningAutomation
                                ? 'bg-amber-500 text-white hover:bg-amber-600'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        )}
                    >
                        {isRunningAutomation ? (
                            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        ) : (
                            <Play className="h-4 w-4" />
                        )}
                        {isRunningAutomation ? 'Running...' : 'Run Automation'}
                    </button>
                </Card>

                <Card
                    title="Execution Logs"
                    description={executionLogs.length ? 'Latest automation run logs.' : 'No execution logs yet.'}
                    status={`${executionLogs.length} log line${executionLogs.length === 1 ? '' : 's'}`}
                >
                    <div className="h-36 overflow-y-auto rounded-md border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-emerald-200">
                        {executionLogs.length ? (
                            executionLogs.map((log, index) => <div key={`${index}-${log.slice(0, 12)}`}>{log}</div>)
                        ) : (
                            <div className="flex h-full items-center text-slate-500">No execution logs yet</div>
                        )}
                    </div>
                </Card>

                <Card
                    title="Reports"
                    description={resolvedReportUrl ? 'Open the latest Playwright HTML report.' : 'No execution report available yet.'}
                    status={resolvedReportUrl ? 'Report available' : 'No report'}
                >
                    <a
                        href={resolvedReportUrl || undefined}
                        target="_blank"
                        rel="noreferrer"
                        aria-disabled={!resolvedReportUrl}
                        className={cn(
                            'inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition',
                            resolvedReportUrl
                                ? 'bg-slate-900 text-white hover:bg-slate-800'
                                : 'pointer-events-none bg-slate-100 text-slate-400'
                        )}
                    >
                        <FileText className="h-4 w-4" />
                        Open Report
                    </a>
                </Card>

                <Card
                    title="Download Script"
                    description={hasScript ? 'Download or copy the generated Playwright script.' : 'No script generated yet.'}
                    status={hasScript ? 'Download enabled' : 'Download disabled'}
                >
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={onDownloadScript}
                            disabled={!hasScript || !onDownloadScript}
                            className={cn(
                                'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition',
                                hasScript ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            )}
                        >
                            <Download className="h-4 w-4" />
                            Download
                        </button>
                        <button
                            type="button"
                            onClick={onCopyScript}
                            disabled={!hasScript || !onCopyScript}
                            className={cn(
                                'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition',
                                hasScript ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                            )}
                        >
                            <Copy className="h-4 w-4" />
                            Copy
                        </button>
                    </div>
                </Card>

                <Card
                    title="View Results"
                    description={hasResults ? 'Review the latest execution summary.' : 'Run automation to view results.'}
                    status={hasResults ? `Duration: ${formatDuration(executionSummary?.durationMs)}` : 'No results'}
                >
                    {executionSummary ? (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-md bg-slate-50 p-2">
                                <div className="font-bold text-slate-900">{executionSummary.total}</div>
                                <div className="text-slate-500">Total</div>
                            </div>
                            <div className="rounded-md bg-emerald-50 p-2">
                                <div className="font-bold text-emerald-700">{executionSummary.passed}</div>
                                <div className="text-emerald-700">Passed</div>
                            </div>
                            <div className="rounded-md bg-red-50 p-2">
                                <div className="font-bold text-red-700">{executionSummary.failed}</div>
                                <div className="text-red-700">Failed</div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            <AlertCircle className="h-4 w-4" />
                            No results yet
                        </div>
                    )}
                    {(passedTests.length > 0 || failedTests.length > 0) && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            {passedTests.length} passed
                            <TerminalSquare className="ml-2 h-3.5 w-3.5 text-red-600" />
                            {failedTests.length} failed
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
