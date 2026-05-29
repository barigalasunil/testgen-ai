"use client";

import { ShieldCheck, Info } from 'lucide-react';

export function JiraPanel() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="border-b border-slate-200 px-4 py-4 bg-white/90">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 font-semibold mb-1">Jira Integration</p>
            <h2 className="text-lg font-semibold text-slate-900">Server-side Jira</h2>
          </div>
          <div className="rounded-2xl bg-emerald-600/10 px-3 py-2 text-xs font-semibold text-emerald-700">Secured</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-700">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold">Jira credentials are handled on the server.</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            All Jira API keys and authentication data are stored in server-only configuration. The browser no longer exposes Jira settings or credential fields.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-700">
            <Info className="w-5 h-5 text-slate-500" />
            <span className="font-semibold">How it works</span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-500 list-disc list-inside">
            <li>Jira calls use server-side secrets from <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">src/config/server-secrets.ts</code> or environment variables.</li>
            <li>There is no Jira settings modal or client-side credential storage anymore.</li>
            <li>Bug creation and test case sync actions still work via secure API routes.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
