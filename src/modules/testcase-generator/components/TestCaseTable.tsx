"use client";

import { useState, useEffect } from "react";
import { Copy, RefreshCw, ThumbsUp, AlertCircle, FileJson, FileSpreadsheet, FileText, CheckCircle2, ExternalLink, Bug, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { TestCase } from "../types";
import { exportExcel, exportCsv, exportJson } from "@/src/services/export/export.service";
import { saveTestCasesToJira } from "@/src/services/jira/jira.service";
import { addRecord, getTraceabilityForRequirement } from "@/src/services/traceability/traceability.service";

interface JiraResult {
    testCaseId: string;
    title: string;
    issueKey?: string;
    issueUrl?: string;
    error?: string;
}

interface TestCaseTableProps {
    data: { testCases: TestCase[] };
    jiraStoryId?: string;
    platformType?: 'web' | 'mobile' | 'api';
    onCopy: () => void;
    onRegenerate: () => void;
    onScriptGenerated?: (code: string, fileName: string) => void;
    onOpenJira?: (testCase: TestCase) => void;
}

export function TestCaseTable({
    data,
    jiraStoryId,
    platformType,
    onCopy,
    onRegenerate,
    onOpenJira,
}: TestCaseTableProps) {
    const [liked, setLiked] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [scriptCode, setScriptCode] = useState<string | null>(null);
    const [scriptFileName, setScriptFileName] = useState<string | null>(null);
    const [showScriptModal, setShowScriptModal] = useState(false);

    const [defects, setDefects] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!jiraStoryId) return;
        const trace = getTraceabilityForRequirement(jiraStoryId);
        const defectMap: Record<string, string> = {};
        for (const tc of data.testCases) {
            const match = trace.defects.find(d => d.metadata?.testCaseId === tc.testCaseId);
            if (match?.jiraKey) defectMap[tc.testCaseId] = match.jiraKey;
        }
        setDefects(defectMap);

        if (!trace.requirement) {
            addRecord({
                id: jiraStoryId,
                type: 'requirement',
                label: jiraStoryId,
                jiraKey: jiraStoryId,
                linkedIds: data.testCases.map(tc => tc.testCaseId),
            });
        }
        for (const tc of data.testCases) {
            addRecord({
                id: tc.testCaseId,
                type: 'testcase',
                label: tc.title,
                jiraKey: tc.testCaseId,
                linkedIds: [jiraStoryId],
            });
        }
    }, [jiraStoryId, data.testCases]);

    // Jira bulk save states
    const [isSavingToJira, setIsSavingToJira] = useState(false);
    const [jiraResult, setJiraResult] = useState<JiraResult | null>(null);
    const [showJiraResult, setShowJiraResult] = useState(false);

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    const handleExport = async (type: "excel" | "csv" | "json") => {
        if (!data?.testCases?.length) return;
        setIsExporting(true);
        try {
            let filename = "";
            if (type === "excel") filename = exportExcel(data.testCases, jiraStoryId);
            else if (type === "csv") filename = exportCsv(data.testCases, jiraStoryId);
            else if (type === "json") filename = exportJson(data.testCases, jiraStoryId);
            showToast(`Exported: ${filename}`);
        } catch {
            showToast("Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleGenerateScript = async () => {
        if (!data?.testCases?.length) return;
        setIsGeneratingScript(true);
        try {
            const response = await fetch('/api/automation/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    testCases: data.testCases,
                    platform: platformType || null,
                    jiraStoryId,
                }),
            });
            const payload = await response.json();
            if (!response.ok || payload.error) throw new Error(payload.message || 'Script generation failed');
            setScriptCode(payload.code || '');
            setScriptFileName(payload.fileName || 'generated.spec.ts');
            setShowScriptModal(true);
            showToast(`Generated: ${payload.fileName}`);
        } catch (error) {
            showToast(`Script generation failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGeneratingScript(false);
        }
    };

    // Creates ONE Jira Task with all test cases as a table
    const handleSaveAllToJira = async () => {
        if (!data?.testCases?.length) return;
        setIsSavingToJira(true);
        setJiraResult(null);
        setShowJiraResult(false);
        try {
            const res = await saveTestCasesToJira({
                testCases: data.testCases,
                storyId: jiraStoryId,
            });
            setJiraResult({
                testCaseId: 'all',
                title: `${data.testCases.length} test cases`,
                issueKey: res.issueKey,
                issueUrl: res.issueUrl,
                error: res.success ? undefined : res.error,
            });
            setShowJiraResult(true);
            if (res.success) {
                showToast(`✓ Task ${res.issueKey} created with ${data.testCases.length} test cases`);
            } else {
                showToast(`✕ ${res.error}`);
            }
        } catch (err) {
            setJiraResult({
                testCaseId: 'all',
                title: '',
                error: err instanceof Error ? err.message : String(err),
            });
            setShowJiraResult(true);
        } finally {
            setIsSavingToJira(false);
        }
    };

    const handleDownloadScript = () => {
        if (!scriptCode || !scriptFileName) return;
        const blob = new Blob([scriptCode], { type: 'text/typescript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = scriptFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`Downloaded ${scriptFileName}`);
    };

    const renderValue = (value: unknown) => {
        if (value === null || typeof value === 'undefined') return "";
        if (typeof value === 'object') {
            try {
                return <pre className="whitespace-pre-wrap text-[13px] font-mono">{JSON.stringify(value, null, 2)}</pre>;
            } catch { return String(value); }
        }
        return String(value);
    };

    if (!data || !data.testCases || data.testCases.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500 border border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                <AlertCircle className="w-8 h-8 mb-2 text-gray-300" />
                <p>No valid test cases found in response.</p>
            </div>
        );
    }

    return (
        <div className="w-full mt-2 relative">

            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 bg-gray-900 text-white text-[13px] px-4 py-2.5 rounded-xl shadow-xl max-w-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{toast}</span>
                </div>
            )}

            {/* Script Modal */}
            {showScriptModal && scriptCode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-w-3xl w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Generated Playwright Script</h3>
                                <p className="text-xs text-slate-500">{scriptFileName}</p>
                            </div>
                            <button onClick={() => setShowScriptModal(false)} className="text-slate-500 hover:text-slate-900 text-sm">Close</button>
                        </div>
                        <div className="max-h-[60vh] overflow-auto bg-slate-950 p-4 text-[13px] text-slate-100">
                            <pre className="whitespace-pre-wrap break-words font-mono">{scriptCode}</pre>
                        </div>
                        <div className="flex gap-2 border-t border-gray-200 bg-slate-50 px-5 py-3">
                            <button
                                onClick={() => { navigator.clipboard.writeText(scriptCode); showToast('Copied!'); }}
                                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 border border-gray-200 hover:bg-slate-100"
                            >
                                Copy Code
                            </button>
                            <button
                                onClick={handleDownloadScript}
                                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Download Script
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Jira Save Result Modal */}
            {showJiraResult && jiraResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-w-md w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                            <h3 className="text-sm font-semibold text-slate-900">
                                {jiraResult.issueKey ? 'Saved to Jira ✓' : 'Jira Save Failed'}
                            </h3>
                            <button onClick={() => setShowJiraResult(false)} className="text-slate-500 hover:text-slate-900 text-sm">
                                Close
                            </button>
                        </div>
                        <div className="p-6 flex flex-col items-center gap-4 text-center">
                            {jiraResult.issueKey ? (
                                <>
                                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">{jiraResult.issueKey}</p>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Task created with {data.testCases.length} test cases as a table
                                        </p>
                                        {jiraStoryId && (
                                            <p className="text-xs text-blue-600 mt-1">Linked to {jiraStoryId}</p>
                                        )}
                                    </div>
                                    {jiraResult.issueUrl && (
                                        <a
                                            href={jiraResult.issueUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                                        >
                                            Open in Jira <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                                        <AlertCircle className="w-7 h-7 text-red-500" />
                                    </div>
                                    <p className="text-sm text-red-600 max-w-xs">{jiraResult.error}</p>
                                    <p className="text-xs text-slate-400">Make sure Jira credentials are saved in settings</p>
                                </>
                            )}
                        </div>
                        <div className="border-t border-gray-200 bg-slate-50 px-5 py-3 flex justify-end">
                            <button
                                onClick={() => setShowJiraResult(false)}
                                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                <table className="w-full text-left text-sm text-gray-800 border-collapse">
                    <thead className="bg-[#fbfcff] text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                        <tr>
                            <th className="p-4 border-b border-gray-100 whitespace-nowrap">ID</th>
                            <th className="p-4 border-b border-gray-100 min-w-[200px]">Title</th>
                            <th className="p-4 border-b border-gray-100 whitespace-nowrap">Priority</th>
                            <th className="p-4 border-b border-gray-100 min-w-[260px]">Steps</th>
                            <th className="p-4 border-b border-gray-100 min-w-[200px]">Expected Result</th>
                            <th className="p-4 border-b border-gray-100 min-w-[120px]">Test Data</th>
                            <th className="p-4 border-b border-gray-100 whitespace-nowrap">Defect</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.testCases.map((tc, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-[#f8faff]/60 transition-colors align-top">
                                <td className="p-4 whitespace-nowrap text-gray-400 font-mono text-xs font-medium">
                                    {tc.testCaseId}
                                </td>
                                <td className="p-4">
                                    <div className="font-semibold text-gray-800 mb-1">{renderValue(tc.title)}</div>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase">
                                        {renderValue(tc.testType)}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={cn(
                                        "text-[11px] px-2 py-1 rounded-full font-bold whitespace-nowrap",
                                        tc.priority === "High" ? "bg-red-50 text-red-600" :
                                        tc.priority === "Medium" ? "bg-orange-50 text-orange-600" :
                                        "bg-green-50 text-green-600"
                                    )}>
                                        {tc.priority}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600 leading-relaxed text-[13px] whitespace-pre-wrap">
                                    {tc.preconditions && tc.preconditions !== "None" && (
                                        <div className="mb-2 p-2 bg-amber-50 rounded text-xs border border-amber-100">
                                            <span className="font-bold text-amber-500 block mb-0.5 uppercase text-[9px]">
                                                Preconditions:
                                            </span>
                                            {renderValue(tc.preconditions)}
                                        </div>
                                    )}
                                    {renderValue(tc.steps)}
                                </td>
                                <td className="p-4 text-emerald-700 font-medium leading-relaxed text-[13px] whitespace-pre-wrap">
                                    {renderValue(tc.expectedResult)}
                                </td>
                                <td className="p-4 text-gray-500 text-xs italic bg-gray-50/30">
                                    {(tc.testData && tc.testData !== "N/A") ? renderValue(tc.testData) : "—"}
                                </td>
                                {/* Defect column — shows linked defect or create button */}
                                <td className="p-4">
                                    {defects[tc.testCaseId] ? (
                                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 whitespace-nowrap">
                                            <Bug className="w-3 h-3" />
                                            {defects[tc.testCaseId]}
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => onOpenJira?.(tc)}
                                            title="Raise a Bug in Jira for this test case"
                                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition whitespace-nowrap"
                                        >
                                            <Bug className="w-3.5 h-3.5" />
                                            Defect
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Toolbar */}
            <div className="mt-4 rounded-3xl border border-gray-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => handleExport("excel")} disabled={isExporting}
                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-green-50 hover:border-green-300 hover:text-green-700 px-3 py-2 rounded-2xl transition-all text-gray-700 shadow-sm font-medium disabled:opacity-50">
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button onClick={() => handleExport("csv")} disabled={isExporting}
                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 px-3 py-2 rounded-2xl transition-all text-gray-700 shadow-sm font-medium disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button onClick={() => handleExport("json")} disabled={isExporting}
                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 px-3 py-2 rounded-2xl transition-all text-gray-700 shadow-sm font-medium disabled:opacity-50">
                        <FileJson className="w-3.5 h-3.5" /> JSON
                    </button>

                    <div className="w-px h-6 bg-gray-200" />

                    <button onClick={handleGenerateScript} disabled={isGeneratingScript}
                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 px-3 py-2 rounded-2xl transition-all text-gray-700 shadow-sm font-medium disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5" />
                        {isGeneratingScript ? 'Generating…' : platformType === 'api' ? 'REST API' : 'Playwright'}
                    </button>

                    <div className="w-px h-6 bg-gray-200" />

                    {/* Save All to Jira — creates one Task with table */}
                    <button
                        onClick={handleSaveAllToJira}
                        disabled={isSavingToJira}
                        className="flex items-center gap-1.5 text-xs bg-blue-600 border border-blue-600 hover:bg-blue-700 px-3 py-2 rounded-2xl transition-all text-white shadow-sm font-semibold disabled:opacity-50"
                    >
                        {isSavingToJira ? (
                            <>
                                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                Saving to Jira...
                            </>
                        ) : (
                            '📋 Save All to Jira'
                        )}
                    </button>

                    <button
                        onClick={() => { onCopy(); showToast("Copied!"); }}
                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-2xl transition-colors text-gray-700 shadow-sm font-medium"
                    >
                        <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                    <button onClick={onRegenerate}
                        className="flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 w-9 h-9 rounded-2xl transition-colors text-gray-700 shadow-sm">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setLiked(!liked)}
                        className={cn(
                            "flex items-center justify-center border border-gray-200 w-9 h-9 rounded-2xl transition-colors shadow-sm",
                            liked ? "bg-green-50 text-green-600 border-green-200" : "bg-white hover:bg-gray-50 text-gray-700"
                        )}>
                        <ThumbsUp className={cn("w-3.5 h-3.5", liked ? "fill-green-600" : "")} />
                    </button>

                    {jiraStoryId && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1">
                            <Link className="w-3 h-3" />
                            {jiraStoryId}
                        </span>
                    )}
                    <span className="text-[11px] text-gray-500 font-medium">
                        {data.testCases.length} test case{data.testCases.length !== 1 ? "s" : ""} generated
                    </span>
                </div>
            </div>
        </div>
    );
}