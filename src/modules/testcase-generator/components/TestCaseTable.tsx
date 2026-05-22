"use client";

import { useState } from "react";
import { Copy, Download, RefreshCw, ThumbsUp, AlertCircle, FileJson, FileSpreadsheet, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TestCase } from "../types";
import { exportExcel, exportCsv, exportJson } from "@/src/services/export/export.service";

interface TestCaseTableProps {
    data: { testCases: TestCase[] };
    jiraStoryId?: string;
    platformType?: 'web' | 'mobile' | 'api';
    onCopy: () => void;
    onRegenerate: () => void;
}

export function TestCaseTable({ data, jiraStoryId, platformType, onCopy, onRegenerate }: TestCaseTableProps) {
    const [liked, setLiked] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [scriptCode, setScriptCode] = useState<string | null>(null);
    const [scriptFileName, setScriptFileName] = useState<string | null>(null);
    const [showScriptModal, setShowScriptModal] = useState(false);

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2500);
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
        } catch (e) {
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
                body: JSON.stringify({ testCases: data.testCases, platform: platformType || null }),
            });
            const payload = await response.json();

            if (!response.ok || payload.error) {
                throw new Error(payload.message || 'Script generation failed');
            }

            setScriptCode(payload.code || '');
            setScriptFileName(payload.fileName || 'generated.spec.ts');
            setShowScriptModal(true);
            showToast(`Generated script: ${payload.fileName}`);
        } catch (error) {
            showToast(`Script generation failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGeneratingScript(false);
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

    const handleCopy = () => {
        onCopy();
        showToast("Copied to clipboard!");
    };

    const renderValue = (value: any) => {
        if (value === null || typeof value === 'undefined') return "";
        if (typeof value === 'object') {
            try {
                return <pre className="whitespace-pre-wrap text-[13px] font-mono">{JSON.stringify(value, null, 2)}</pre>;
            } catch (e) {
                return String(value);
            }
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

            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 bg-gray-900 text-white text-[13px] px-4 py-2.5 rounded-xl shadow-xl animate-in slide-in-from-top-2 duration-200 max-w-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{toast}</span>
                </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                {/* Export group */}
                <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
                    <button
                        onClick={() => handleExport("excel")}
                        title="Export Excel (.xlsx)"
                        disabled={isExporting}
                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-green-50 hover:border-green-300 hover:text-green-700 px-2.5 py-1.5 rounded-md transition-all text-gray-700 shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button
                        onClick={() => handleExport("csv")}
                        title="Export CSV (.csv)"
                        disabled={isExporting}
                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 px-2.5 py-1.5 rounded-md transition-all text-gray-700 shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileText className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button
                        onClick={() => handleExport("json")}
                        title="Export JSON (.json)"
                        disabled={isExporting}
                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 px-2.5 py-1.5 rounded-md transition-all text-gray-700 shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileJson className="w-3.5 h-3.5" /> JSON
                    </button>
                </div>

                <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 px-2.5 py-1.5 rounded-md transition-all text-gray-700 shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FileText className="w-3.5 h-3.5" />
                    {isGeneratingScript ? 'Generating…' : 'Generate Script'}
                </button>

                <div className="w-px h-5 bg-gray-200"></div>

                {/* Copy */}
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-md transition-colors text-gray-700 shadow-sm font-medium"
                >
                    <Copy className="w-3.5 h-3.5" /> Copy
                </button>

                <div className="w-px h-5 bg-gray-200"></div>

                {/* Regenerate */}
                <button
                    title="Regenerate"
                    onClick={onRegenerate}
                    className="flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 w-8 h-8 rounded-md transition-colors text-gray-700 shadow-sm"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>

                {/* Thumbs up */}
                <button
                    title="Helpful"
                    onClick={() => setLiked(!liked)}
                    className={cn(
                        "flex items-center justify-center border border-gray-200 w-8 h-8 rounded-md transition-colors shadow-sm",
                        liked ? "bg-green-50 text-green-600 border-green-200" : "bg-white hover:bg-gray-50 text-gray-700"
                    )}
                >
                    <ThumbsUp className={cn("w-3.5 h-3.5", liked ? "fill-green-600" : "")} />
                </button>

                {/* Count badge */}
                <span className="ml-auto text-[11px] text-gray-400 font-medium">
                    {data.testCases.length} test case{data.testCases.length !== 1 ? "s" : ""} generated
                </span>
            </div>

            {showScriptModal && scriptCode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-w-3xl w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Generated Playwright Script</h3>
                                <p className="text-xs text-slate-500">{scriptFileName}</p>
                            </div>
                            <button onClick={() => setShowScriptModal(false)} className="text-slate-500 hover:text-slate-900">Close</button>
                        </div>
                        <div className="max-h-[60vh] overflow-auto bg-slate-950 p-4 text-[13px] text-slate-100">
                            <pre className="whitespace-pre-wrap break-words font-mono">{scriptCode}</pre>
                        </div>
                        <div className="flex flex-wrap gap-2 border-t border-gray-200 bg-slate-50 px-5 py-3">
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(scriptCode);
                                    showToast('Script copied to clipboard');
                                }}
                                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 border border-gray-200 hover:bg-slate-100"
                            >
                                Copy Code
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadScript}
                                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Download Script
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
                        </tr>
                    </thead>
                    <tbody>
                        {data.testCases.map((tc, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-[#f8faff]/60 transition-colors align-top">
                                <td className="p-4 whitespace-nowrap text-gray-400 font-mono text-xs font-medium">{tc.testCaseId}</td>
                                <td className="p-4">
                                    <div className="font-semibold text-gray-800 mb-1">{renderValue(tc.title)}</div>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase">{renderValue(tc.testType)}</span>
                                </td>
                                <td className="p-4">
                                    <span className={cn(
                                        "text-[11px] px-2 py-1 rounded-full font-bold whitespace-nowrap",
                                        tc.priority === "High" ? "bg-red-50 text-red-600" :
                                        tc.priority === "Medium" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
                                    )}>
                                        {tc.priority}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600 leading-relaxed text-[13px] whitespace-pre-wrap">
                                    {tc.preconditions && tc.preconditions !== "None" && (
                                        <div className="mb-2 p-2 bg-amber-50 rounded text-xs border border-amber-100">
                                            <span className="font-bold text-amber-500 block mb-0.5 uppercase text-[9px]">Preconditions:</span>
                                            {renderValue(tc.preconditions)}
                                        </div>
                                    )}
                                    {renderValue(tc.steps)}
                                </td>
                                <td className="p-4 text-emerald-700 font-medium leading-relaxed text-[13px] whitespace-pre-wrap">{renderValue(tc.expectedResult)}</td>
                                <td className="p-4 text-gray-500 text-xs italic bg-gray-50/30">{(tc.testData && tc.testData !== "N/A") ? renderValue(tc.testData) : "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
