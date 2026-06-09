"use client";

import { ShieldCheck, Info } from 'lucide-react';

export function JiraPanel() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-4 bg-white/90 dark:bg-slate-900/90">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500 font-bold mb-1">Jira Integration</p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Enterprise Traceability</h2>
          </div>
          <div className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
            Secured
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="font-bold text-base">Secret Management</span>
          </div>
          <p className="text-sm leading-7 text-slate-500 dark:text-slate-400">
            All Jira API keys and authentication data are stored in server-only configuration. The browser no longer exposes Jira settings or credential fields to ensure zero-trust security.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <Info className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
            <span className="font-bold text-base">Key Features</span>
          </div>
          <ul className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
              <span>Full Jira API integration using server-side secrets from environment variables or secure vault.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
              <span>Bi-directional traceability between generated test cases and source Jira story requirements.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
              <span>Automated bug reporting with AI-enhanced summaries and structured reproduction steps.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
