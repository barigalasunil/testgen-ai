"use client";

import { useState } from 'react';
import { Play, ShieldCheck, CheckCircle2, AlertCircle, Clock3, FileText } from 'lucide-react';

type SuiteKey = 'smoke' | 'sanity' | 'regression';

type SuiteState = {
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastRunAt?: string;
  reportUrl?: string;
  message?: string;
  durationMs?: number;
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
  message?: string;
};

const suites: { key: SuiteKey; label: string; description: string }[] = [
  { key: 'smoke', label: 'Smoke Suite', description: 'Quick login validation tests.' },
  { key: 'sanity', label: 'Sanity Suite', description: 'Login and add to cart flow.' },
  { key: 'regression', label: 'Regression Suite', description: 'Complete checkout purchase flow.' },
];

const initialState: Record<SuiteKey, SuiteState> = {
  smoke: { status: 'idle' },
  sanity: { status: 'idle' },
  regression: { status: 'idle' },
};

export function AutomationDashboard() {
  const [suiteStates, setSuiteStates] = useState<Record<SuiteKey, SuiteState>>(initialState);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const executeSuite = async (suite: SuiteKey) => {
    setSuiteStates((prev) => ({
      ...prev,
      [suite]: { ...prev[suite], status: 'running', message: undefined },
    }));

    try {
      const response = await fetch('/api/automation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suite }),
      });
      const payload = (await response.json()) as AutomationRunResponse;

      if (!response.ok || payload.error) {
        setSuiteStates((prev) => ({
          ...prev,
          [suite]: {
            status: 'failed',
            lastRunAt: new Date().toISOString(),
            reportUrl: payload.reportUrl,
            message: payload.message || payload.output || 'Automation failed.',
            durationMs: payload.durationMs,
          },
        }));
        showToast(`Suite ${suite} failed`);
        return;
      }

      setSuiteStates((prev) => ({
        ...prev,
        [suite]: {
          status: 'completed',
          lastRunAt: payload.finishedAt,
          reportUrl: payload.reportUrl,
          message: 'Execution succeeded.',
          durationMs: payload.durationMs,
        },
      }));
      showToast(`Suite ${suite} completed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSuiteStates((prev) => ({
        ...prev,
        [suite]: {
          status: 'failed',
          lastRunAt: new Date().toISOString(),
          message,
        },
      }));
      showToast(`Suite ${suite} failed`);
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Never run';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="mb-6 rounded-3xl border border-gray-200 bg-slate-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Automation Execution Dashboard</h2>
          <p className="text-sm text-slate-500">Run SauceDemo suites and open the latest Playwright reports.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          Backend execution via API
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {suites.map((suite) => {
          const state = suiteStates[suite.key];
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
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
