"use client";

import { useEffect, useState } from "react";
import { X, Bug } from "lucide-react";
import * as jiraService from "@/src/services/jira/jira.service";
import { TestCase } from "../types";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    testCase: TestCase | null;
    requirementId?: string;
};

export default function JiraModal({ isOpen, onClose, testCase, requirementId }: Props) {
    const [tab, setTab] = useState<'ai' | 'quick'>('ai');
    const [actualResult, setActualResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [summary, setSummary] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [labels, setLabels] = useState('regression, saucedemo');
    const [resultMsg, setResultMsg] = useState<{
        success: boolean;
        text: string;
        url?: string;
    } | null>(null);

    useEffect(() => {
        if (isOpen && testCase) {
            setActualResult('');
            setSummary(`[BUG] ${testCase.title || ''}`);
            setDescription(
                `Steps to Reproduce:\n${testCase.steps || ''}\n\nExpected Result:\n${testCase.expectedResult || ''}\n\nActual Result:\n(fill in)`
            );
            setPriority(testCase.priority || 'Medium');
            setLabels('regression, saucedemo');
            setResultMsg(null);
            setTab('ai');
        }
    }, [isOpen, testCase]);

    const handleGenerate = async () => {
        if (!testCase) return;
        setAiLoading(true);
        setResultMsg(null);
        try {
            const res = await jiraService.generateDefect({
                testCaseTitle: testCase.title,
                testCaseSteps: testCase.steps,
                expectedResult: testCase.expectedResult,
                actualResult,
                model: 'mistral:7b',
            });
            if (res?.success) {
                setSummary(res.summary || summary);
                setDescription(res.description || description);
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

    const buildDefectPayload = () => ({
        summary,
        description,
        issueType: 'Bug',
        priority,
        labels: labels.split(',').map(s => s.trim()).filter(Boolean),
        storyId: requirementId,
        traceability: requirementId
            ? { sourceId: requirementId, sourceType: 'requirement', testCaseId: testCase?.testCaseId }
            : undefined,
    });

    const handleCreate = async () => {
        setLoading(true);
        setResultMsg(null);
        try {
            const res = await jiraService.createIssue(buildDefectPayload());
            if (res?.success) {
                setResultMsg({ success: true, text: `Created ${res.issueKey}`, url: res.issueUrl });
            } else {
                setResultMsg({ success: false, text: res.error || 'Failed to create issue' });
            }
        } catch (err) {
            setResultMsg({ success: false, text: err instanceof Error ? err.message : String(err) });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickCreate = async () => {
        setLoading(true);
        setResultMsg(null);
        try {
            const res = await jiraService.createIssue(buildDefectPayload());
            if (res?.success) {
                setResultMsg({ success: true, text: `Created ${res.issueKey}`, url: res.issueUrl });
            } else {
                setResultMsg({ success: false, text: res.error || 'Failed to create issue' });
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
            <div className="w-full max-w-2xl rounded-2xl bg-slate-900 text-slate-100 shadow-2xl border border-slate-700 max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <Bug className="w-4 h-4 text-red-400" />
                        <h3 className="text-base font-semibold">Create Jira Bug</h3>
                        <span className="text-xs bg-red-900/50 text-red-300 border border-red-700 px-2 py-0.5 rounded-full font-mono">
                            Bug
                        </span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 px-4 pt-3 shrink-0">
                    <button
                        onClick={() => setTab('ai')}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${tab === 'ai' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                        🤖 AI Defect Reporter
                    </button>
                    <button
                        onClick={() => setTab('quick')}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${tab === 'quick' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                        ⚡ Quick Create
                    </button>
                </div>

                {/* Body — scrollable */}
                {requirementId && (
                    <div className="px-4 pt-2 shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-blue-400 bg-blue-900/20 border border-blue-800/30 rounded-lg px-2.5 py-1.5">
                            <span>🔗</span>
                            <span>Linked to Requirement: <strong>{requirementId}</strong></span>
                        </div>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-4">
                    {tab === 'ai' ? (
                        <div className="flex flex-col gap-3">

                            {/* Test case preview */}
                            <div className="rounded-xl border border-slate-700 p-3 bg-slate-800/60">
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Test Case</p>
                                <p className="text-sm font-semibold text-slate-100">{testCase?.title}</p>
                                <pre className="mt-2 max-h-28 overflow-auto text-xs text-slate-300 bg-slate-900/60 p-2 rounded whitespace-pre-wrap">
                                    {testCase?.steps}
                                </pre>
                            </div>

                            {/* Actual result */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Actual Result <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    value={actualResult}
                                    onChange={e => setActualResult(e.target.value)}
                                    placeholder="What actually happened? e.g. Login failed with 500 error instead of showing error message"
                                    className="w-full rounded-lg p-2.5 bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    rows={3}
                                />
                            </div>

                            {/* Priority */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                                <select
                                    value={priority}
                                    onChange={e => setPriority(e.target.value)}
                                    className="w-full rounded-lg p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none"
                                >
                                    <option>High</option>
                                    <option>Medium</option>
                                    <option>Low</option>
                                </select>
                            </div>

                            {/* Generate button */}
                            <button
                                onClick={handleGenerate}
                                disabled={aiLoading || !actualResult.trim()}
                                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-700 transition"
                            >
                                {aiLoading ? (
                                    <>
                                        <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                        Generating bug report...
                                    </>
                                ) : '🤖 Generate Bug Report with AI'}
                            </button>

                            {/* Generated fields */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Bug Summary</label>
                                <input
                                    value={summary}
                                    onChange={e => setSummary(e.target.value)}
                                    className="w-full rounded-lg p-2.5 bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Bug Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full rounded-lg p-2.5 bg-slate-800 border border-slate-700 text-sm text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    rows={6}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Labels</label>
                                <input
                                    value={labels}
                                    onChange={e => setLabels(e.target.value)}
                                    className="w-full rounded-lg p-2.5 bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none"
                                    placeholder="regression, saucedemo"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="rounded-xl border border-red-800/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
                                Quick create will raise a <strong>Bug</strong> ticket directly without AI generation.
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Summary</label>
                                <input
                                    value={summary}
                                    onChange={e => setSummary(e.target.value)}
                                    className="w-full rounded-lg p-2.5 bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full rounded-lg p-2.5 bg-slate-800 border border-slate-700 text-sm text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    rows={6}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                                <select
                                    value={priority}
                                    onChange={e => setPriority(e.target.value)}
                                    className="w-full rounded-lg p-2 bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none"
                                >
                                    <option>High</option>
                                    <option>Medium</option>
                                    <option>Low</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Labels</label>
                                <input
                                    value={labels}
                                    onChange={e => setLabels(e.target.value)}
                                    className="w-full rounded-lg p-2.5 bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none"
                                    placeholder="regression, saucedemo"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-slate-800 p-4 flex items-center justify-between gap-3">
                    {/* Result banner */}
                    {resultMsg && (
                        <div className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${resultMsg.success ? 'bg-emerald-900/40 border border-emerald-700 text-emerald-300' : 'bg-red-900/40 border border-red-700 text-red-300'}`}>
                            {resultMsg.success ? (
                                <span>
                                    ✓ {resultMsg.text}
                                    {resultMsg.url && (
                                        <a href={resultMsg.url} target="_blank" rel="noreferrer"
                                            className="ml-2 underline text-emerald-200 hover:text-white">
                                            Open ↗
                                        </a>
                                    )}
                                </span>
                            ) : (
                                <span>✕ {resultMsg.text}</span>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={onClose}
                            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={tab === 'ai' ? handleCreate : handleQuickCreate}
                            disabled={loading || !summary.trim()}
                            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    Creating Bug...
                                </>
                            ) : (
                                <><Bug className="w-3.5 h-3.5" /> Create Bug</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}