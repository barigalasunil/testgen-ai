"use client";

import { useState, useEffect } from "react";
import { 
    AlertCircle, CheckCircle2, Copy, ExternalLink, FileText,
    Bug, FileSpreadsheet, FileJson, Tag, RefreshCw,
    ShieldCheck, Play, BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QualityReport, TestCase } from "../types";
import { exportExcel, exportCsv, exportJson } from "@/src/services/export/export.service";
import { saveTestCasesToJira } from "@/src/services/jira/jira.service";

interface JiraResult {
    testCaseId: string;
    title: string;
    issueKey?: string;
    issueUrl?: string;
    error?: string;
}

interface TestCaseTableProps {
    data: { testCases: TestCase[] };
    qualityReport?: QualityReport;
    jiraStoryId?: string;
    platformType?: 'web' | 'mobile' | 'api' | 'automation';
    onCopy: () => void;
    onRegenerate: () => void;
    onGenerateScript?: () => void;
    onRunAutomation?: () => void;
    onCopyScript?: () => void;
    onDownloadScript?: () => void;
    hasGeneratedScript?: boolean;
    isGeneratingScript?: boolean;
    isRunningAutomation?: boolean;
    onScriptGenerated?: (code: string, fileName: string) => void;
    onOpenJira?: (testCase: TestCase) => void;
}

export function TestCaseTable({
    data,
    qualityReport,
    jiraStoryId,
    onCopy,
    onRegenerate,
    onGenerateScript,
    onRunAutomation,
    hasGeneratedScript,
    isGeneratingScript,
    isRunningAutomation,
    onOpenJira,
}: TestCaseTableProps) {
    const [toast, setToast] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [showQualityReport, setShowQualityReport] = useState(false);

    const [defects] = useState<Record<string, string>>({});

    useEffect(() => {
        // Traceability visualization logic handled via props
    }, [jiraStoryId, data.testCases]);

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
            <div className="flex flex-col items-center justify-center p-8 text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/50">
                <AlertCircle className="w-8 h-8 mb-2 text-gray-300 dark:text-gray-700" />
                <p>No valid test cases found in response.</p>
            </div>
        );
    }

    return (
        <div className="w-full mt-2 relative">

            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 bg-gray-900 dark:bg-slate-800 text-white text-[13px] px-4 py-2.5 rounded-xl shadow-xl border border-white/10 max-w-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{toast}</span>
                </div>
            )}

            {/* Jira Save Result Modal */}
            {showJiraResult && jiraResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="max-w-md w-full overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-white/5">
                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-5 py-4">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {jiraResult.issueKey ? 'Saved to Jira ✓' : 'Jira Save Failed'}
                            </h3>
                            <button onClick={() => setShowJiraResult(false)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-sm">
                                Close
                            </button>
                        </div>
                        <div className="p-6 flex flex-col items-center gap-4 text-center">
                            {jiraResult.issueKey ? (
                                <>
                                    <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                                        <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{jiraResult.issueKey}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            Task created with {data.testCases.length} test cases as a table
                                        </p>
                                        {jiraStoryId && (
                                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Linked to {jiraStoryId}</p>
                                        )}
                                    </div>
                                    {jiraResult.issueUrl && (
                                        <a
                                            href={jiraResult.issueUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                                        >
                                            Open in Jira <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                                        <AlertCircle className="w-7 h-7 text-red-500 dark:text-red-400" />
                                    </div>
                                    <p className="text-sm text-red-600 dark:text-red-400 max-w-xs">{jiraResult.error}</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Make sure Jira credentials are saved in settings</p>
                                </>
                            )}
                        </div>
                        <div className="border-t border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-3 flex justify-end">
                            <button
                                onClick={() => setShowJiraResult(false)}
                                className="rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showQualityReport && qualityReport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Quality Report</h3>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Traceability matrix, RAGAS-style evaluation, and improvement suggestions.
                                </p>
                            </div>
                            <button onClick={() => setShowQualityReport(false)} className="rounded-md px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                                Close
                            </button>
                        </div>
                        <div className="max-h-[72vh] space-y-5 overflow-auto p-5 text-sm">
                            <section className="grid gap-3 md:grid-cols-4">
                                {[
                                    ["Quality Score", `${qualityReport.qualityScore.overall}%`],
                                    ["Requirement Coverage", `${qualityReport.qualityScore.requirementCoverage}%`],
                                    ["RAGAS Faithfulness", qualityReport.ragasScore.available ? `${qualityReport.ragasScore.faithfulness}%` : "Not available"],
                                    ["Hallucination Risk", qualityReport.ragasScore.hallucinationRisk],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 dark:border-gray-800 dark:bg-slate-950">
                                        <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
                                        <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{value}</div>
                                    </div>
                                ))}
                            </section>

                            <section>
                                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">AC to Test Case Mapping</h4>
                                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                                    {qualityReport.acToTestCaseMapping.map((row, index) => (
                                        <div key={`${row.acceptanceCriterion}-${index}`} className="grid gap-2 border-b border-gray-100 p-3 last:border-b-0 dark:border-gray-800 md:grid-cols-[1fr_220px]">
                                            <div className="text-slate-700 dark:text-slate-300">{row.acceptanceCriterion}</div>
                                            <div className="font-mono text-xs font-bold text-[#10A37F]">{row.testCaseIds.join(", ") || "No mapped test cases"}</div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Missing Coverage</h4>
                                    <ul className="space-y-2">
                                        {(qualityReport.missingCoverage.length ? qualityReport.missingCoverage : ["None detected"]).map(item => (
                                            <li key={item} className="rounded-lg border border-gray-200 px-3 py-2 text-slate-700 dark:border-gray-800 dark:text-slate-300">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Duplicate Scenarios</h4>
                                    <ul className="space-y-2">
                                        {(qualityReport.duplicateScenarios.length ? qualityReport.duplicateScenarios : [{ scenario: "None detected", testCaseIds: [] }]).map(item => (
                                            <li key={`${item.scenario}-${item.testCaseIds.join("-")}`} className="rounded-lg border border-gray-200 px-3 py-2 text-slate-700 dark:border-gray-800 dark:text-slate-300">
                                                {item.scenario}
                                                {item.testCaseIds.length ? <span className="ml-2 font-mono text-xs text-[#10A37F]">{item.testCaseIds.join(", ")}</span> : null}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </section>

                            <section>
                                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">RAGAS-style Evaluation</h4>
                                {!qualityReport.ragasScore.available ? (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
                                        RAGAS Score not available — no retrieved context used.
                                    </div>
                                ) : (
                                    <div className="grid gap-2 md:grid-cols-5">
                                        {[
                                            ["Context Relevance", qualityReport.ragasScore.contextRelevance],
                                            ["Context Precision", qualityReport.ragasScore.contextPrecision],
                                            ["Context Recall", qualityReport.ragasScore.contextRecall],
                                            ["Faithfulness", qualityReport.ragasScore.faithfulness],
                                            ["Answer Relevance", qualityReport.ragasScore.answerRelevance],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                                                <div className="text-xs font-bold text-slate-500">{label}</div>
                                                <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">{value}%</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section>
                                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Improvement Suggestions</h4>
                                <ul className="space-y-2">
                                    {qualityReport.improvementSuggestions.map(item => (
                                        <li key={item} className="rounded-lg border border-gray-200 px-3 py-2 text-slate-700 dark:border-gray-800 dark:text-slate-300">{item}</li>
                                    ))}
                                </ul>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            {qualityReport && (
                <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <div>
                                <div className="text-[10px] font-bold uppercase text-slate-500">Quality Score</div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">{qualityReport.qualityScore.overall}%</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase text-slate-500">Requirement Coverage</div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">{qualityReport.qualityScore.requirementCoverage}%</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase text-slate-500">RAGAS Faithfulness</div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">{qualityReport.ragasScore.available ? `${qualityReport.ragasScore.faithfulness}%` : "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase text-slate-500">Context Relevance</div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">{qualityReport.ragasScore.available ? `${qualityReport.ragasScore.contextRelevance}%` : "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase text-slate-500">Hallucination Risk</div>
                                <div className={cn(
                                    "text-lg font-bold",
                                    qualityReport.ragasScore.hallucinationRisk === "Low" ? "text-emerald-600 dark:text-emerald-400" :
                                        qualityReport.ragasScore.hallucinationRisk === "Medium" ? "text-amber-600 dark:text-amber-400" :
                                            "text-red-600 dark:text-red-400"
                                )}>{qualityReport.ragasScore.hallucinationRisk}</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowQualityReport(true)}
                            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#10A37F] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d8c6d]"
                        >
                            <BarChart3 className="h-4 w-4" />
                            View Quality Report
                        </button>
                    </div>
                    {!qualityReport.ragasScore.available && (
                        <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">RAGAS Score not available — no retrieved context used.</p>
                    )}
                </div>
            )}

            {/* Table Area */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
                <table className="w-full text-left text-sm text-gray-800 dark:text-gray-200 border-collapse">
                    <thead className="bg-[#fbfcff] dark:bg-slate-900/50 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[11px] font-bold">
                        <tr>
                            <th className="p-4 border-b border-gray-100 dark:border-gray-800 whitespace-nowrap">Test Case ID</th>
                            <th className="p-4 border-b border-gray-100 dark:border-gray-800 min-w-[200px]">Scenario Title</th>
                            <th className="p-4 border-b border-gray-100 dark:border-gray-800 whitespace-nowrap">Test Type</th>
                            <th className="p-4 border-b border-gray-100 dark:border-gray-800 whitespace-nowrap">Priority</th>
                            <th className="p-4 border-b border-gray-100 dark:border-gray-800 min-w-[200px]">Preconditions</th>
                            <th className="p-4 border-b border-gray-100 dark:border-gray-800 min-w-[120px]">Test Data</th>
                            <th className="p-4 border-b border-gray-100 dark:border-gray-800 min-w-[260px]">Test Steps</th>
                            <th className="p-4 border-b border-gray-100 dark:border-gray-800 min-w-[200px]">Expected Result</th>
                            <th className="p-4 border-b border-gray-100 dark:border-gray-800 whitespace-nowrap">Defect</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.testCases.map((tc, i) => (
                            <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-[#f8faff]/60 dark:hover:bg-white/5 transition-colors align-top">
                                <td className="p-4 align-top w-24">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-mono text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                                            {tc.testCaseId}
                                        </span>
                                        {tc.linkedRequirementId && (
                                            <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-tight flex items-center gap-0.5" title="Linked Requirement">
                                                <Tag className="w-2 h-2" /> {tc.linkedRequirementId}
                                            </span>
                                        )}
                                        {tc.executionStatus && (
                                            <span className={cn(
                                                "text-[9px] font-bold uppercase tracking-tight flex items-center gap-0.5",
                                                tc.executionStatus === 'Passed' ? "text-emerald-500" :
                                                tc.executionStatus === 'Failed' ? "text-red-500" :
                                                "text-gray-400 dark:text-gray-600"
                                            )}>
                                                {tc.executionStatus === 'Passed' && <CheckCircle2 className="w-2 h-2" />}
                                                {tc.executionStatus === 'Failed' && <Bug className="w-2 h-2" />}
                                                {tc.executionStatus}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 font-semibold text-gray-800 dark:text-gray-100">
                                    {renderValue(tc.scenarioTitle)}
                                </td>
                                <td className="p-4">
                                    <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded font-bold uppercase whitespace-nowrap",
                                        tc.testType === 'E2E' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                                        tc.testType === 'Negative' || tc.testType === 'Security' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                                        tc.testType === 'Edge' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                                        tc.testType === 'Boundary' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' :
                                        tc.testType === 'Resilience' ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' :
                                        tc.testType === 'Persona' ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400' :
                                        'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                    )}>
                                        {renderValue(tc.testType)}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={cn(
                                        "text-[11px] px-2 py-1 rounded-full font-bold whitespace-nowrap shadow-sm",
                                        tc.priority === "P1" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                        tc.priority === "P2" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    )}>
                                        {tc.priority}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600 dark:text-gray-400 leading-relaxed text-[13px] whitespace-pre-wrap">
                                    {renderValue(tc.preconditions)}
                                </td>
                                <td className="p-4 text-gray-500 dark:text-gray-500 text-xs italic bg-gray-50/30 dark:bg-white/5">
                                    {(tc.testData && tc.testData !== "N/A") ? renderValue(tc.testData) : "—"}
                                </td>
                                <td className="p-4 text-gray-600 dark:text-gray-400 leading-relaxed text-[13px] whitespace-pre-wrap">
                                    {renderValue(tc.testSteps)}
                                </td>
                                <td className="p-4 text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed text-[13px] whitespace-pre-wrap">
                                    {renderValue(tc.expectedResult)}
                                </td>
                                <td className="p-4">
                                    {defects[tc.testCaseId] ? (
                                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                            <Bug className="w-3 h-3" />
                                            {defects[tc.testCaseId]}
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => onOpenJira?.(tc)}
                                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all whitespace-nowrap shadow-sm"
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

            {/* Toolbar Area */}
            <div className="mt-4 rounded-3xl border border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-slate-800/20 p-4 shadow-sm transition-colors">
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => handleExport("excel")} disabled={isExporting}
                        className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/10 hover:border-green-300 dark:hover:border-green-800 px-3 py-2 rounded-2xl transition-all text-gray-700 dark:text-gray-300 shadow-sm font-medium disabled:opacity-50">
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button onClick={() => handleExport("csv")} disabled={isExporting}
                        className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-300 dark:hover:border-blue-800 px-3 py-2 rounded-2xl transition-all text-gray-700 dark:text-gray-300 shadow-sm font-medium disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button onClick={() => handleExport("json")} disabled={isExporting}
                        className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/10 hover:border-purple-300 dark:hover:border-purple-800 px-3 py-2 rounded-2xl transition-all text-gray-700 dark:text-gray-300 shadow-sm font-medium disabled:opacity-50">
                        <FileJson className="w-3.5 h-3.5" /> JSON
                    </button>

                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

                    <button
                        onClick={handleSaveAllToJira}
                        disabled={isSavingToJira}
                        className="flex items-center gap-1.5 text-xs bg-blue-600 dark:bg-blue-700 border border-blue-600 dark:border-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 px-3 py-2 rounded-2xl transition-all text-white shadow-md font-semibold disabled:opacity-50"
                    >
                        {isSavingToJira ? (
                            <>
                                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                Saving...
                            </>
                        ) : (
                            '📋 Save All to Jira'
                        )}
                    </button>

                    <button
                        onClick={() => { onCopy(); showToast("Copied!"); }}
                        className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 px-3 py-2 rounded-2xl transition-colors text-gray-700 dark:text-gray-300 shadow-sm font-medium"
                    >
                        <Copy className="w-3.5 h-3.5" /> Copy
                    </button>

                    {onGenerateScript && (
                        <button
                            onClick={onGenerateScript}
                            disabled={isGeneratingScript}
                            className={cn(
                                'flex items-center gap-1.5 text-xs rounded-2xl px-3 py-2 transition-all font-medium shadow-sm',
                                isGeneratingScript
                                    ? 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600'
                                    : 'bg-violet-600 dark:bg-violet-700 border border-violet-600 dark:border-violet-700 text-white hover:bg-violet-700 dark:hover:bg-violet-600'
                            )}
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {isGeneratingScript ? 'Generating...' : 'Generate Script'}
                        </button>
                    )}

                    {onRunAutomation && (
                        <button
                            onClick={onRunAutomation}
                            disabled={!hasGeneratedScript || isRunningAutomation}
                            className={cn(
                                'flex items-center gap-1.5 text-xs rounded-2xl px-3 py-2 transition-all font-medium shadow-sm',
                                !hasGeneratedScript || isRunningAutomation
                                    ? 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600'
                                    : 'bg-amber-500 dark:bg-amber-600 border border-amber-500 dark:border-amber-600 text-white hover:bg-amber-600 dark:hover:bg-amber-500'
                            )}
                        >
                            <Play className="w-3.5 h-3.5" />
                            {isRunningAutomation ? 'Running...' : 'Run Automation'}
                        </button>
                    )}

                    <button onClick={onRegenerate}
                        className="flex items-center justify-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 w-9 h-9 rounded-2xl transition-colors text-gray-700 dark:text-gray-300 shadow-sm">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex-1" />

                    <span className="text-[11px] text-gray-500 dark:text-gray-500 font-medium whitespace-nowrap">
                        {data.testCases.length} Cases
                    </span>
                </div>
            </div>
        </div>
    );
}
