"use client";

import { useEffect, useState } from 'react';
import { KeyRound, RotateCcw, Save, Settings, Trash2 } from 'lucide-react';
import {
  DEFAULT_PROVIDER_SETTINGS,
  clearProviderSettings,
  loadProviderSettings,
  maskSecret,
  saveProviderSettings,
} from '@/src/services/ai/ai-config.service';
import { ProviderSettings } from '@/src/services/ai/provider-orchestrator';
import {
  JiraCredentials,
  clearJiraCredentials,
  loadJiraCredentials,
  saveJiraCredentials,
} from '@/src/services/jira/jira.service';

const emptyJira: JiraCredentials = {
  baseUrl: '',
  email: '',
  apiToken: '',
  projectKey: '',
};

type ProviderField = keyof ProviderSettings;
type JiraField = keyof JiraCredentials;

function Field({
  label,
  value,
  type = 'text',
  placeholder,
  savedMask,
  onChange,
}: {
  label: string;
  value: string;
  type?: 'text' | 'password' | 'url';
  placeholder?: string;
  savedMask?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
        {savedMask && <span className="normal-case tracking-normal text-slate-400">{savedMask}</span>}
      </span>
      <input
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-[#10A37F] focus:ring-2 focus:ring-[#10A37F]/10"
      />
    </label>
  );
}

export function JiraPanel() {
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(DEFAULT_PROVIDER_SETTINGS);
  const [jira, setJira] = useState<JiraCredentials>(emptyJira);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setProviderSettings(loadProviderSettings());
    setJira(loadJiraCredentials() || emptyJira);
  }, []);

  const updateProvider = (field: ProviderField, value: string) => {
    setProviderSettings(prev => ({ ...prev, [field]: value }));
  };

  const updateJira = (field: JiraField, value: string) => {
    setJira(prev => ({ ...prev, [field]: value }));
  };

  const saveAi = () => {
    saveProviderSettings(providerSettings);
    setNotice('AI provider settings saved.');
    window.dispatchEvent(new Event('tcgen-provider-settings-updated'));
  };

  const resetAi = () => {
    clearProviderSettings();
    setProviderSettings(DEFAULT_PROVIDER_SETTINGS);
    setNotice('AI provider settings reset.');
    window.dispatchEvent(new Event('tcgen-provider-settings-updated'));
  };

  const saveJira = () => {
    saveJiraCredentials(jira);
    setNotice('Jira credentials saved.');
  };

  const resetJira = () => {
    clearJiraCredentials();
    setJira(emptyJira);
    setNotice('Jira credentials removed.');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Settings</p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Provider and Jira Management</h2>
          </div>
          <div className="rounded-full border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Local
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {notice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300">
            {notice}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-300">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">AI Provider Settings</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Saved locally in this browser. Keys are never logged by TCGen-Buddy.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={resetAi} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
              <button onClick={saveAi} className="inline-flex items-center gap-1.5 rounded-lg bg-[#10A37F] px-3 py-2 text-xs font-bold text-white hover:bg-[#0d8c6d]">
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="NVIDIA API Key" value={providerSettings.nvidiaApiKey || ''} type="password" savedMask={maskSecret(providerSettings.nvidiaApiKey)} onChange={(v) => updateProvider('nvidiaApiKey', v)} />
            <Field label="NVIDIA Model" value={providerSettings.nvidiaModel || ''} placeholder="llama-3.1-nemotron..." onChange={(v) => updateProvider('nvidiaModel', v)} />
            <Field label="OpenRouter API Key" value={providerSettings.openrouterApiKey || ''} type="password" savedMask={maskSecret(providerSettings.openrouterApiKey)} onChange={(v) => updateProvider('openrouterApiKey', v)} />
            <Field label="OpenRouter Model" value={providerSettings.openrouterModel || ''} placeholder="openai/gpt-4o-mini" onChange={(v) => updateProvider('openrouterModel', v)} />
            <Field label="Groq API Key" value={providerSettings.groqApiKey || ''} type="password" savedMask={maskSecret(providerSettings.groqApiKey)} onChange={(v) => updateProvider('groqApiKey', v)} />
            <Field label="Groq Model" value={providerSettings.groqModel || ''} placeholder="llama-3.1-8b-instant" onChange={(v) => updateProvider('groqModel', v)} />
            <Field label="OpenCode API Key" value={providerSettings.opencodeApiKey || ''} type="password" savedMask={maskSecret(providerSettings.opencodeApiKey)} onChange={(v) => updateProvider('opencodeApiKey', v)} />
            <Field label="OpenCode Model" value={providerSettings.opencodeModel || ''} onChange={(v) => updateProvider('opencodeModel', v)} />
            <Field label="Ollama Base URL" value={providerSettings.ollamaBaseUrl || ''} type="url" placeholder="http://localhost:11434" onChange={(v) => updateProvider('ollamaBaseUrl', v)} />
            <Field label="Ollama Model" value={providerSettings.ollamaModel || ''} placeholder="mistral" onChange={(v) => updateProvider('ollamaModel', v)} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Jira Settings</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Used for story fetch, traceability, and defect creation.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={resetJira} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
              <button onClick={saveJira} className="inline-flex items-center gap-1.5 rounded-lg bg-[#10A37F] px-3 py-2 text-xs font-bold text-white hover:bg-[#0d8c6d]">
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Jira Base URL" value={jira.baseUrl} type="url" placeholder="https://company.atlassian.net" onChange={(v) => updateJira('baseUrl', v)} />
            <Field label="Jira Email" value={jira.email} onChange={(v) => updateJira('email', v)} />
            <Field label="Jira API Token" value={jira.apiToken} type="password" savedMask={maskSecret(jira.apiToken)} onChange={(v) => updateJira('apiToken', v)} />
            <Field label="Jira Project Key" value={jira.projectKey} placeholder="TCGB" onChange={(v) => updateJira('projectKey', v)} />
          </div>
        </section>
      </div>
    </div>
  );
}
