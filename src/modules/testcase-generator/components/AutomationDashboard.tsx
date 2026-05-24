"use client";

import { useState } from 'react';
import { Play, ShieldCheck, CheckCircle2, Clock3, FileText, Monitor, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SuiteExecution, SuiteKey } from '../types';

type AutomationDashboardProps = {
    automation?: Record<SuiteKey, SuiteExecution>;
    onExecuteSuite?: (suite: SuiteKey, headed: boolean) => void;
    compact?: boolean;
};

const suites: { key: SuiteKey; label: string; description: string }[] = [
    { key: 'smoke', label: 'Smoke Suite', description: 'Quick validation of critical paths.' },
    { key: 'sanity', label: 'Sanity Suite', description: 'Core flow validations.' },
    { key: 'regression', label: 'Regression Suite', description: 'Full regression coverage.' },
];

const initialState: Record<SuiteKey, SuiteExecution> = {
    smoke: { status: 'idle' },
    sanity: { status: 'idle' },
    regression: { status: 'idle' },
};

export function AutomationDashboard({
    automation = initialState,
    onExecuteSuite,
    compact = false,
}: AutomationDashboardProps) {
    const [toast, setToast] = useState<string | null>(null);
    // headed toggle — when ON, browser opens visibly on screen
    const [headed, setHeaded] = useState(false);

    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(null), 2500);
    };

    const executeSuite = (suite: SuiteKey) => {
        showToast(`Running ${suite} suite${headed ? ' (browser visible)' : ' (headless)'}...`);
        onExecuteSuite?.(suite, headed);
    };

    const formatDuration = (ms?: number) => {
        if (!ms) return '';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatTimestamp = (timestamp?: string) => {
        if (!timestamp) return 'Never run';
        return new Date(timestamp).toLocaleTimeString();
    };

    const HeadedToggle = (
        <button
            onClick={() => setHeaded(!headed)}
            className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all',
                headed
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            )}
            title={headed ? 'Browser will open visibly (demo mode)' : 'Browser runs in background (headless)'}
        >
            {headed
                ? <><Monitor className="w-3.5 h-3.5" /> Browser visible</>
                : <><EyeOff className="w-3.5 h-3.5" /> Headless</>
            }
        </button>
    );

    if (compact) {
        return (
            <div className="relative rounded-2xl border border-gray-200 bg-slate-50 shadow-sm p-4 h-full flex flex-col min-h-0">
                <div className="flex-shrink-0 mb-3">
                    <h2 className="text-sm font-semibold text-slate-900">Automation Dashboard</h2>
                    <p className="text-xs text-slate-500">Execute suites and view reports.</p>
                </div>

                {/* Headed toggle */}
                <div className="flex-shrink-0 flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500">Mode:</span>
                    {HeadedToggle}
                </div>

                {headed && (
                    <div className="flex-shrink-0 mb-3 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                        🖥 Demo mode — Chrome will open on your screen and run tests visibly with 0.5s slowdown.
                    </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="grid gap-3 grid-cols-1">
                        {suites.map((suite) => {
                            const state = automation[suite.key];
                            const isRunning = state.status === 'running';

                            return (
                                <div key={suite.key} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm flex-shrink-0">
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-900">{suite.label}</h3>
                                            <p className="text-xs text-slate-500">{suite.description}</p>
                                        </div>
                                        <span className={cn(
                                            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                            state.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                            state.status === 'failed' ? 'bg-red-100 text-red-700' :
                                            state.status === 'running' ? 'bg-blue-100 text-blue-700' :
                                            'bg-slate-100 text-slate-500'
                                        )}>
                                            {state.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                                        <span className="flex items-center gap-1">
                                            <Clock3 className="w-3 h-3" />
                                            {formatTimestamp(state.lastRunAt)}
                                        </span>
                                        {state.durationMs !== undefined && (
                                            <span className="flex items-center gap-1">
                                                <Play className="w-3 h-3" />
                                                {formatDuration(state.durationMs)}
                                            </span>
                                        )}
                                    </div>

                                    {state.reportUrl && (
                                        <a href={state.reportUrl} target="_blank" rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 mb-3">
                                            <FileText className="w-3 h-3" />
                                            View Report
                                        </a>
                                    )}

                                    <button
                                        type="button"
                                        disabled={isRunning}
                                        onClick={() => executeSuite(suite.key)}
                                        className={cn(
                                            'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
                                            headed
                                                ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400'
                                                : 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400'
                                        )}
                                    >
                                        {isRunning ? (
                                            <>
                                                <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                                Running...
                                            </>
                                        ) : (
                                            <>
                                                {headed ? <Monitor className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                                Run {suite.key.charAt(0).toUpperCase() + suite.key.slice(1)}
                                            </>
                                        )}
                                    </button>

                                    {state.status === 'failed' && state.message && (
                                        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                            <span className="font-semibold">Failed: </span>{state.message}
                                        </div>
                                    )}
                                    {state.status === 'completed' && (
                                        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> All tests passed
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="h-4 flex-shrink-0" />
                </div>

                {toast && (
                    <div className="absolute bottom-4 right-4 z-50 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
                        {toast}
                    </div>
                )}
            </div>
        );
    }

    // Full (non-compact) version
    return (
        <div className="relative rounded-2xl border border-gray-200 bg-slate-50 shadow-sm mb-6 p-5">
            <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="font-semibold text-slate-900 text-lg">Automation Dashboard</h2>
                    <p className="text-sm text-slate-500">Execute suites and inspect reports.</p>
                </div>
                <div className="flex items-center gap-3">
                    {HeadedToggle}
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 shadow-sm">
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                        API execution
                    </div>
                </div>
            </div>

            {headed && (
                <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
                    🖥 Demo mode active — Chrome will open visibly and run at 0.5s per action so you can see each step.
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
                {suites.map((suite) => {
                    const state = automation[suite.key];
                    const isRunning = state.status === 'running';
                    return (
                        <div key={suite.key} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">{suite.label}</h3>
                                    <p className="text-xs text-slate-500">{suite.description}</p>
                                </div>
                                <span className={cn(
                                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                                    state.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                    state.status === 'failed' ? 'bg-red-100 text-red-700' :
                                    state.status === 'running' ? 'bg-blue-100 text-blue-700' :
                                    'bg-slate-100 text-slate-500'
                                )}>
                                    {state.status}
                                </span>
                            </div>
                            <div className="space-y-2 text-xs text-slate-500 mb-4">
                                <div className="flex items-center gap-2">
                                    <Clock3 className="w-3.5 h-3.5" />
                                    {formatTimestamp(state.lastRunAt)}
                                </div>
                                {state.durationMs !== undefined && (
                                    <div className="flex items-center gap-2">
                                        <Play className="w-3.5 h-3.5" />
                                        {formatDuration(state.durationMs)}
                                    </div>
                                )}
                                {state.reportUrl && (
                                    <a href={state.reportUrl} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                                        <FileText className="w-3 h-3" /> Open Report
                                    </a>
                                )}
                            </div>
                            <button
                                type="button"
                                disabled={isRunning}
                                onClick={() => executeSuite(suite.key)}
                                className={cn(
                                    'w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition',
                                    headed
                                        ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400'
                                        : 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400'
                                )}
                            >
                                {isRunning ? 'Running…' : `Run ${suite.key.charAt(0).toUpperCase() + suite.key.slice(1)}`}
                            </button>
                            {state.status === 'failed' && state.message && (
                                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                    {state.message}
                                </div>
                            )}
                            {state.status === 'completed' && (
                                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                                    <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" /> Passed
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {toast && (
                <div className="absolute bottom-4 right-4 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
                    {toast}
                </div>
            )}
        </div>
    );
}