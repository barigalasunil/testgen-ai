"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import * as jiraService from "@/src/services/jira/jira.service";
import { TestCase } from "../types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  testCase: TestCase | null;
};

export default function JiraModal({ isOpen, onClose, testCase }: Props) {
  const [tab, setTab] = useState<'ai' | 'quick'>('ai');
  const [actualResult, setActualResult] = useState('');
  const [issueType, setIssueType] = useState('Bug');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [generated, setGenerated] = useState<{ summary?: string; description?: string; priority?: string; labels?: string[] } | null>(null);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [labels, setLabels] = useState('');
  const [resultMsg, setResultMsg] = useState<{ success: boolean; text: string; url?: string } | null>(null);

  useEffect(() => {
    if (isOpen && testCase) {
      setActualResult('');
      setSummary(testCase.title || '');
      setDescription((testCase.steps || '') + '\n\nExpected: ' + (testCase.expectedResult || ''));
      setPriority(testCase.priority || 'Medium');
      setLabels('');
      setGenerated(null);
      setResultMsg(null);
    }
  }, [isOpen, testCase]);

  const handleGenerate = async () => {
    if (!testCase) return;
    setAiLoading(true);
    try {
      const payload = {
        testCaseTitle: testCase.title,
        testCaseSteps: testCase.steps,
        expectedResult: testCase.expectedResult,
        actualResult,
        model: 'mistral:7b',
      };
      const res = await jiraService.generateDefect(payload);
      if (res && res.success) {
        setGenerated(res);
        setSummary(res.summary || '');
        setDescription(res.description || '');
        setPriority(res.priority || 'Medium');
        setLabels((res.labels || []).join(', '));
      } else {
        setResultMsg({ success: false, text: res.error || 'AI generation failed' });
      }
    } catch (err) {
      setResultMsg({ success: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const payload = {
        summary,
        description,
        issueType,
        priority,
        labels: labels.split(',').map(s => s.trim()).filter(Boolean),
      };
      const res = await jiraService.createIssue(payload);
      if (res && res.success) {
        setResultMsg({ success: true, text: `Created ${res.issueKey}`, url: res.issueUrl });
      } else {
        setResultMsg({ success: false, text: res.error || 'Create issue failed' });
      }
    } catch (err) {
      setResultMsg({ success: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 text-slate-100 shadow-2xl border border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold">Jira Integration</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setTab('ai')} className={`px-3 py-2 rounded-2xl ${tab === 'ai' ? 'bg-slate-800 text-white' : 'bg-slate-700/40 text-slate-300'}`}>AI Defect Reporter</button>
            <button onClick={() => setTab('quick')} className={`px-3 py-2 rounded-2xl ${tab === 'quick' ? 'bg-slate-800 text-white' : 'bg-slate-700/40 text-slate-300'}`}>Quick Create</button>
          </div>

          {tab === 'ai' ? (
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-slate-700 p-3 bg-slate-800">
                <div className="text-sm text-slate-300 font-semibold">Test Case</div>
                <div className="mt-2 text-sm text-slate-100 font-medium">{testCase?.title}</div>
                <pre className="mt-2 max-h-40 overflow-auto text-xs text-slate-300 bg-slate-900 p-2 rounded">{testCase?.steps}</pre>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Actual Result</label>
                <textarea value={actualResult} onChange={e => setActualResult(e.target.value)} className="w-full rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100" rows={3} />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm text-slate-300 mb-1">Issue Type</label>
                  <select value={issueType} onChange={e => setIssueType(e.target.value)} className="w-full rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100">
                    <option>Bug</option>
                    <option>Story</option>
                    <option>Task</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} className="rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100">
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Generated Summary</label>
                <input value={summary} onChange={e => setSummary(e.target.value)} className="w-full rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100" />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Generated Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100" rows={6} />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Labels (comma separated)</label>
                <input value={labels} onChange={e => setLabels(e.target.value)} className="w-full rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100" />
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handleGenerate} disabled={aiLoading} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{aiLoading ? 'Generating…' : 'Generate with AI'}</button>
                <button onClick={handleCreate} disabled={loading} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60">{loading ? 'Creating…' : 'Create in Jira'}</button>
                {resultMsg && (
                  <div className={`ml-auto rounded-full px-3 py-1 text-sm ${resultMsg.success ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {resultMsg.success ? `✓ ${resultMsg.text}` : `✕ ${resultMsg.text}`}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Summary</label>
                <input value={summary} onChange={e => setSummary(e.target.value)} className="w-full rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100" rows={6} />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm text-slate-300 mb-1">Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100">
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-slate-300 mb-1">Issue Type</label>
                  <select value={issueType} onChange={e => setIssueType(e.target.value)} className="w-full rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100">
                    <option>Bug</option>
                    <option>Story</option>
                    <option>Task</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Labels (comma separated)</label>
                <input value={labels} onChange={e => setLabels(e.target.value)} className="w-full rounded-md p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100" />
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handleCreate} disabled={loading} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60">{loading ? 'Creating…' : 'Create Issue'}</button>
                {resultMsg && (
                  <div className={`ml-auto rounded-full px-3 py-1 text-sm ${resultMsg.success ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {resultMsg.success ? `✓ ${resultMsg.text}` : `✕ ${resultMsg.text}`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
