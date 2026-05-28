"use client";

import { useState } from 'react';
import { Play, Monitor, EyeOff, ShieldCheck, Clock3, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Zap, Bug, Search, RefreshCw, Globe, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SuiteKey, SuiteExecution } from '../types';

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
    platformType?: string;
}

const suites: { key: SuiteKey; label: string }[] = [
    { key: 'smoke', label: 'Smoke Suite' },
    { key: 'sanity', label: 'Sanity Suite' },
    { key: 'regression', label: 'Regression Suite' },
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
    executionLogs,
    executionSummary,
    passedTests,
    failedTests,
    headed,
    onHeadedChange,
    reportUrl,
    platformType,
}: AutomationSidebarContentProps) {
    const [sectionOpen, setSectionOpen] = useState(true);
    const [suitesOpen, setSuitesOpen] = useState(true);
    const [executionOpen, setExecutionOpen] = useState(true);
    const [reportsOpen, setReportsOpen] = useState(true);

    const isWeb = !platformType || platformType === 'web';
    const isApi = platformType === 'api';
    const isMobile = platformType === 'mobile';
    const showPlaywrightCta = isWeb;
    const showApiCta = isApi;

    return (
        <div className="border-t border-gray-200">
            {/* Header */}
            <button
                onClick={() => setSectionOpen(!sectionOpen)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-50/50 transition-colors"
            >
                {sectionOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Zap className="w-3.5 h-3.5" />
                {isApi ? 'API Automation' : isMobile ? 'Mobile Automation' : 'Automation Workspace'}
            </button>

            {sectionOpen && (
                <div className="px-2 pb-3 space-y-2">
                    {/* Headed toggle — Web only */}
                    {showPlaywrightCta && (
                        <button
                            onClick={() => onHeadedChange(!headed)}
                            className={cn(
                                'w-full flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all',
                                headed
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            )}
                        >
                            {headed ? <Monitor className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            {headed ? 'Browser Visible' : 'Headless'}
                        </button>
                    )}

                    {/* Suites — Web only */}
                    {showPlaywrightCta && (
                        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                            <button
                                onClick={() => setSuitesOpen(!suitesOpen)}
                                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                <span>Suites</span>
                                {suitesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                            {suitesOpen && (
                                <div className="p-2 space-y-1.5">
                                    {suites.map((suite) => {
                                        const state = automation[suite.key];
                                        const isRunning = state.status === 'running';
                                        return (
                                            <div key={suite.key} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-semibold text-slate-800 truncate">{suite.label}</span>
                                                        <span className={cn(
                                                            'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                                                            state.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                            state.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                            state.status === 'running' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-400'
                                                        )}>
                                                            {state.status}
                                                        </span>
                                                    </div>
                                                    {state.durationMs !== undefined && (
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <Clock3 className="w-2.5 h-2.5 text-slate-400" />
                                                            <span className="text-[10px] text-slate-400">{state.durationMs < 1000 ? `${state.durationMs}ms` : `${(state.durationMs / 1000).toFixed(1)}s`}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    disabled={isRunning}
                                                    onClick={() => onExecuteSuite(suite.key, headed)}
                                                    className={cn(
                                                        'shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition',
                                                        isRunning
                                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                            : headed
                                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                                : 'bg-slate-800 text-white hover:bg-slate-700'
                                                    )}
                                                >
                                                    {isRunning ? (
                                                        <span className="h-2 w-2 rounded-full border border-current border-t-transparent animate-spin" />
                                                    ) : (
                                                        <Play className="w-2.5 h-2.5" />
                                                    )}
                                                    Run
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Generate Script — labels change by platform */}
                    <button
                        onClick={onGenerateScript}
                        disabled={!hasTestCases || isGeneratingScript}
                        className={cn(
                            'w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition border',
                            hasTestCases && !isGeneratingScript
                                ? isApi
                                    ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-violet-600 border-violet-600 text-white hover:bg-violet-700'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        )}
                    >
                        {isGeneratingScript ? (
                            <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        ) : isApi ? (
                            <Code2 className="w-3.5 h-3.5" />
                        ) : (
                            <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        {isGeneratingScript
                            ? 'Generating...'
                            : isApi
                                ? 'Generate API Automation'
                                : 'Generate Playwright Script'}
                    </button>

                    {/* Run Automation — labels change by platform */}
                    {scriptCode && (
                        <button
                            onClick={onRunAutomation}
                            disabled={isRunningAutomation}
                            className={cn(
                                'w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed',
                                isApi
                                    ? 'bg-emerald-500 border border-emerald-500 hover:bg-emerald-600'
                                    : 'bg-amber-500 border border-amber-500 hover:bg-amber-600'
                            )}
                        >
                            {isRunningAutomation ? (
                                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                                <Play className="w-3.5 h-3.5" />
                            )}
                            {isRunningAutomation ? 'Running...' : isApi ? 'Run API Tests' : 'Run Automation'}
                        </button>
                    )}

                    {/* Platform info badge */}
                    {isApi && scriptCode && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[10px] text-emerald-700 font-medium">
                            Using Playwright APIRequestContext — no browser required
                        </div>
                    )}

                    {/* Mobile placeholder */}
                    {isMobile && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 text-center">
                            Appium / mobile automation coming soon
                        </div>
                    )}

                    {/* Execution logs */}
                    {executionLogs.length > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                            <button
                                onClick={() => setExecutionOpen(!executionOpen)}
                                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 hover:bg-slate-100"
                            >
                                <span>Execution Logs</span>
                                {executionOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                            {executionOpen && (
                                <div className="max-h-[200px] overflow-y-auto bg-slate-950 p-2 font-mono text-[11px] text-green-400">
                                    {executionLogs.map((log, i) => (
                                        <div key={i} className="whitespace-pre-wrap break-words leading-5">
                                            {log}
                                        </div>
                                    ))}
                                    {isRunningAutomation && (
                                        <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                            Executing...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Execution summary */}
                    {executionSummary && (
                        <div className="rounded-lg border border-gray-200 bg-white p-2">
                            <div className="flex items-center gap-3 text-xs">
                                <span className="font-bold text-slate-800">{executionSummary.total} total</span>
                                <span className="text-emerald-600 font-semibold">{executionSummary.passed} passed</span>
                                <span className={executionSummary.failed > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}>{executionSummary.failed} failed</span>
                                <span className="text-slate-400">{(executionSummary.durationMs / 1000).toFixed(1)}s</span>
                            </div>
                            {executionSummary.failed === 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> All passed
                                </div>
                            )}
                            {executionSummary.failed > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[10px] text-red-600 font-medium">
                                    <AlertCircle className="w-2.5 h-2.5" /> {executionSummary.failed} failed
                                </div>
                            )}
                        </div>
                    )}

                    {/* Passed/failed test lists */}
                    {failedTests.length > 0 && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                            <p className="text-[10px] font-bold text-red-600 mb-1">Failed Tests</p>
                            <div className="space-y-0.5 max-h-20 overflow-y-auto">
                                {failedTests.map((name, i) => (
                                    <div key={i} className="text-[10px] text-red-700 truncate">✘ {name}</div>
                                ))}
                            </div>
                        </div>
                    )}
                    {passedTests.length > 0 && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-[10px] font-bold text-emerald-600 mb-1">Passed Tests</p>
                            <div className="space-y-0.5 max-h-20 overflow-y-auto">
                                {passedTests.map((name, i) => (
                                    <div key={i} className="text-[10px] text-emerald-700 truncate">✓ {name}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reports */}
                    {(reportUrl || executionSummary?.reportUrl) && (
                        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                            <button
                                onClick={() => setReportsOpen(!reportsOpen)}
                                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 hover:bg-slate-100"
                            >
                                <span>Reports</span>
                                {reportsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                            {reportsOpen && (
                                <div className="p-2">
                                    <a
                                        href={reportUrl || executionSummary?.reportUrl || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-700 transition"
                                    >
                                        <FileText className="w-3 h-3" />
                                        View Full Report
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Placeholder sections for future */}
                    {showPlaywrightCta && (
                        <>
                            <div className="rounded-lg border border-gray-200 bg-white p-2 opacity-60">
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                    <Search className="w-3 h-3" />
                                    Exploratory Testing
                                    <span className="ml-auto text-[9px]">Coming soon</span>
                                </div>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-white p-2 opacity-60">
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                    <RefreshCw className="w-3 h-3" />
                                    Heal Failures
                                    <span className="ml-auto text-[9px]">Coming soon</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
