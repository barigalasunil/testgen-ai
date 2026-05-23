"use client";

import { useState } from 'react';
import { Play, ShieldCheck, CheckCircle2, Clock3, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SuiteExecution, SuiteKey } from '../types';

type AutomationDashboardProps = {
  automation: Record<SuiteKey, SuiteExecution>;
  onExecuteSuite: (suite: SuiteKey) => void;
  compact?: boolean;
};

type AutomationRunResponse = {
  error: boolean;
  suite: SuiteKey;
  status: 'completed' | 'failed';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  reportUrl: string;
  output?: string;
  stderr?: string;
  message?: string;
};

const suites: { key: SuiteKey; label: string; description: string }[] = [
  { key: 'smoke', label: 'Smoke Suite', description: 'Quick validation checks for critical paths.' },
  { key: 'sanity', label: 'Sanity Suite', description: 'Core flow validations for recent changes.' },
  { key: 'regression', label: 'Regression Suite', description: 'Comprehensive regression coverage for releases.' },
];

const initialState: Record<SuiteKey, SuiteExecution> = {
  smoke: { status: 'idle' },
  sanity: { status: 'idle' },
  regression: { status: 'idle' },
};

export function AutomationDashboard({ automation = initialState, onExecuteSuite, compact = false }: AutomationDashboardProps) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const executeSuite = async (suite: SuiteKey) => {
    showToast(`Running ${suite} suite...`);
    onExecuteSuite(suite);
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Never run';
    return new Date(timestamp).toLocaleString();
  };

    return (
    <div className={cn(
      "relative rounded-3xl border border-gray-200 bg-slate-50 shadow-sm",
      compact ? "p-4" : "mb-6 p-5"
    )}>
      <div className={cn(
        "flex flex-col gap-3 mb-4",
        compact ? "" : "md:flex-row md:items-center md:justify-between"
      )}>
        <div>
          <h2 className={cn("font-semibold text-slate-900", compact ? "text-base" : "text-lg")}>Automation Execution Dashboard</h2>
          <p className="text-sm text-slate-500">Execute automation suites and inspect execution reports.</p>
        </div>
        <div className={cn(
          "inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 shadow-sm",
          compact ? "justify-start" : ""
        )}>
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          Backend execution via API
        </div>
      </div>

      <div className={cn("grid gap-4", compact ? "grid-cols-1" : "md:grid-cols-3")}>
        {suites.map((suite) => {
          const state = automation[suite.key];
          const isRunning = state.status === 'running';

          return (
            <div key={suite.key} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{suite.label}</h3>
                  <p className="text-xs text-slate-500">{suite.description}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  {state.status}
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-slate-400" />
                  <span>{formatTimestamp(state.lastRunAt)}</span>
                </div>
                {state.durationMs !== undefined && (
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-slate-400" />
                    <span>{state.durationMs} ms</span>
                  </div>
                )}
                {state.reportUrl && (
                  <a
                    href={state.reportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Open Latest Report
                  </a>
                )}
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => executeSuite(suite.key)}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isRunning ? 'Running…' : 'Run Suite'}
                </button>
                {state.status === 'failed' && state.message && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <div className="font-semibold">Error</div>
                    <p className="truncate">{state.message}</p>
                  </div>
                )}
                {state.status === 'completed' && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <CheckCircle2 className="inline-block w-4 h-4 mr-1 align-text-bottom" /> Completed
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="absolute bottom-4 right-4 z-50 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
