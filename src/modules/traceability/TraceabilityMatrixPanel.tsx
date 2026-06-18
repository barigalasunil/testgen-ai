"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    Bug,
    Code2,
    Download,
    FileJson,
    FileText,
    FlaskConical,
    RefreshCw,
    Search,
    ShieldCheck,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    buildStoryView,
    buildTraceabilityReport,
    CoverageStatus,
    exportTraceabilityCsv,
    exportTraceabilityJson,
    exportTraceabilityPdf,
    loadTraceabilityRecord,
    searchTraceability,
    traceabilityDownload,
    TraceabilityRecord,
    TraceabilityStoryView,
} from "@/src/services/traceability/traceability.service";

const fallbackProjects = ["TCGB", "TCA", "DEMO"];
const coverageFilters: Array<CoverageStatus | "All"> = ["All", "Covered", "Partial", "Missing"];

function downloadName(extension: string) {
    return `tcgen-traceability-report.${extension}`;
}

function coverageStatus(view: TraceabilityStoryView) {
    if (view.coverage.missing > 0) return "Missing" as CoverageStatus;
    if (view.coverage.partial > 0) return "Partial" as CoverageStatus;
    return "Covered" as CoverageStatus;
}

function statusClass(status: CoverageStatus) {
    if (status === "Covered") return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-900/50";
    if (status === "Partial") return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-900/50";
    return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-900/50";
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="border-b border-slate-200 pb-5 last:border-b-0 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
            <div className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-200">{children}</div>
        </section>
    );
}

function TraceabilityDetailsModal({ view, onClose }: { view: TraceabilityStoryView; onClose: () => void }) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const missingCoverage = view.acceptanceCriteria.filter(item => item.status === "Missing");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <section className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#10A37F]">{view.jiraId}</p>
                        <h2 className="mt-1 truncate text-xl font-bold text-slate-900 dark:text-white">{view.summary}</h2>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Close details">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                    <DetailSection title="Story Description">
                        <p className="whitespace-pre-wrap">{view.description || "No story description stored yet."}</p>
                    </DetailSection>

                    <DetailSection title="Acceptance Criteria">
                        {view.acceptanceCriteria.length ? (
                            <div className="space-y-4">
                                {view.acceptanceCriteria.map(item => (
                                    <div key={item.acId} className="border-l-2 border-slate-200 pl-3 dark:border-slate-800">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-bold text-slate-900 dark:text-white">{item.acId}</p>
                                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold ring-1", statusClass(item.status))}>{item.status}</span>
                                        </div>
                                        <p className="mt-1">{item.description}</p>
                                    </div>
                                ))}
                            </div>
                        ) : <p>No acceptance criteria stored.</p>}
                    </DetailSection>

                    <DetailSection title="Linked Test Cases">
                        {view.linkedAssets.generatedTestCases.length ? (
                            <ul className="space-y-2">
                                {view.linkedAssets.generatedTestCases.map(testCase => (
                                    <li key={testCase.tcId}><strong>{testCase.tcId}</strong> - {testCase.title}</li>
                                ))}
                            </ul>
                        ) : <p>No linked test cases found.</p>}
                    </DetailSection>

                    <DetailSection title="Linked Defects">
                        {view.linkedAssets.defects.length ? (
                            <ul className="space-y-2">
                                {view.linkedAssets.defects.map(defect => (
                                    <li key={defect.defectId}><strong>{defect.defectId}</strong> - {defect.summary}</li>
                                ))}
                            </ul>
                        ) : <p>No linked defects found.</p>}
                    </DetailSection>

                    <DetailSection title="Linked Automation Runs">
                        {view.linkedAssets.automationRuns.length ? (
                            <ul className="space-y-2">
                                {view.linkedAssets.automationRuns.map(run => (
                                    <li key={run.runId}>
                                        <strong>{run.runId}</strong>{run.suite ? ` - ${run.suite}` : ""}
                                        {run.status ? ` - ${run.status}` : ""}
                                        {run.healingAttempted ? ` - healing ${run.healingStatus || "attempted"}` : ""}
                                        {run.healedScriptPath ? <div className="truncate text-xs text-slate-500 dark:text-slate-400">Healed script: {run.healedScriptPath}</div> : null}
                                    </li>
                                ))}
                            </ul>
                        ) : <p>No linked automation runs found.</p>}
                    </DetailSection>

                    <DetailSection title="Linked Memory Vault Records">
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-slate-400" /> Test case records: {view.linkedAssets.generatedTestCases.length}</div>
                            <div className="flex items-center gap-2"><Bug className="h-4 w-4 text-slate-400" /> Defect records: {view.linkedAssets.defects.length}</div>
                            <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-slate-400" /> Automation records: {view.linkedAssets.automationRuns.length}</div>
                            <div className="flex items-center gap-2"><Code2 className="h-4 w-4 text-slate-400" /> API records: {view.linkedAssets.apiAssets.length}</div>
                            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-400" /> Quality report records: {view.linkedAssets.qualityReports.length}</div>
                        </div>
                    </DetailSection>

                    <DetailSection title="Coverage Gaps">
                        {missingCoverage.length ? (
                            <ul className="space-y-2">
                                {missingCoverage.map(item => (
                                    <li key={item.acId}><strong>{item.acId}</strong> - {item.description}. No linked test cases found.</li>
                                ))}
                            </ul>
                        ) : <p>No coverage gaps detected.</p>}
                    </DetailSection>
                </div>

                <div className="flex justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                    <button onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
                        Close
                    </button>
                </div>
            </section>
        </div>
    );
}

export function TraceabilityMatrixPanel() {
    const [record, setRecord] = useState<TraceabilityRecord>(() => loadTraceabilityRecord());
    const [query, setQuery] = useState("");
    const [projectFilter, setProjectFilter] = useState("All");
    const [coverageFilter, setCoverageFilter] = useState<CoverageStatus | "All">("All");
    const [detailsView, setDetailsView] = useState<TraceabilityStoryView | null>(null);
    const [reportGeneratedAt, setReportGeneratedAt] = useState<string | null>(null);

    const refresh = () => setRecord(loadTraceabilityRecord());

    useEffect(() => {
        const handler = () => refresh();
        window.addEventListener("tcgen-memory-vault-updated", handler);
        window.addEventListener("tcgen-traceability-updated", handler);
        return () => {
            window.removeEventListener("tcgen-memory-vault-updated", handler);
            window.removeEventListener("tcgen-traceability-updated", handler);
        };
    }, []);

    const projects = useMemo(() => {
        const keys = Array.from(new Set(record.stories.map(story => story.projectKey).filter(Boolean))).sort();
        return Array.from(new Set([...fallbackProjects, ...keys]));
    }, [record.stories]);

    const rows = useMemo(() => {
        return searchTraceability(record, query)
            .filter(story => projectFilter === "All" || story.projectKey === projectFilter)
            .map(story => buildStoryView(story.storyId, record))
            .filter((view): view is TraceabilityStoryView => Boolean(view))
            .filter(view => coverageFilter === "All" || coverageStatus(view) === coverageFilter);
    }, [coverageFilter, projectFilter, query, record]);

    const report = useMemo(() => buildTraceabilityReport(record), [record]);

    const handleGenerateReport = () => setReportGeneratedAt(report.generatedAt);

    const handleExport = (type: "json" | "csv" | "pdf") => {
        const activeReport = buildTraceabilityReport(record);
        if (type === "json") traceabilityDownload(downloadName("json"), exportTraceabilityJson(activeReport), "application/json;charset=utf-8");
        if (type === "csv") traceabilityDownload(downloadName("csv"), exportTraceabilityCsv(activeReport), "text/csv;charset=utf-8");
        if (type === "pdf") exportTraceabilityPdf(activeReport);
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-white text-slate-900 dark:bg-gray-950 dark:text-slate-100">
            <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 md:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Traceability Matrix</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A readable matrix of stories, coverage, and linked QA assets.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={refresh} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Refresh
                        </button>
                        <button onClick={handleGenerateReport} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#10A37F] px-3 text-xs font-bold text-white hover:bg-[#0d8c6d]">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Generate Traceability Report
                        </button>
                        <button type="button" onClick={() => handleExport("pdf")} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900" title="Export PDF">
                            <Download className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleExport("csv")} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900" title="Export CSV">
                            <FileText className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleExport("json")} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900" title="Export JSON">
                            <FileJson className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                {reportGeneratedAt ? (
                    <p className="mt-2 text-xs font-semibold text-[#0d8c6d] dark:text-[#34d399]">
                        Report generated with {report.rows.length} stories at {new Date(reportGeneratedAt).toLocaleString()}.
                    </p>
                ) : null}
            </header>

            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 md:px-6">
                <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_180px_220px]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="Search by story, test case, defect, or automation run"
                            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#10A37F] dark:border-slate-700 dark:bg-slate-950"
                        />
                    </div>
                    <select
                        value={projectFilter}
                        onChange={event => setProjectFilter(event.target.value)}
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#10A37F] dark:border-slate-700 dark:bg-slate-950"
                    >
                        {["All", ...projects].map(project => <option key={project} value={project}>{project === "All" ? "All Projects" : project}</option>)}
                    </select>
                    <select
                        value={coverageFilter}
                        onChange={event => setCoverageFilter(event.target.value as CoverageStatus | "All")}
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#10A37F] dark:border-slate-700 dark:bg-slate-950"
                    >
                        {coverageFilters.map(status => <option key={status} value={status}>{status === "All" ? "All Coverage Statuses" : status}</option>)}
                    </select>
                </div>
            </div>

            <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
                            <tr>
                                <th className="px-4 py-3">Jira Story</th>
                                <th className="px-4 py-3">Story Summary</th>
                                <th className="px-4 py-3">Acceptance Criteria Count</th>
                                <th className="px-4 py-3">Test Cases Count</th>
                                <th className="px-4 py-3">Defects Count</th>
                                <th className="px-4 py-3">Automation Runs Count</th>
                                <th className="px-4 py-3">Coverage Status</th>
                                <th className="px-4 py-3">Coverage %</th>
                                <th className="px-4 py-3">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                            {rows.length ? rows.map(view => {
                                const status = coverageStatus(view);
                                return (
                                    <tr key={view.storyId} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                                        <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900 dark:text-white">{view.jiraId}</td>
                                        <td className="max-w-md px-4 py-3 text-slate-600 dark:text-slate-300">{view.summary}</td>
                                        <td className="px-4 py-3">{view.coverage.total}</td>
                                        <td className="px-4 py-3">{view.linkedAssets.generatedTestCases.length}</td>
                                        <td className="px-4 py-3">{view.linkedAssets.defects.length}</td>
                                        <td className="px-4 py-3">{view.linkedAssets.automationRuns.length}</td>
                                        <td className="px-4 py-3">
                                            <span className={cn("rounded-full px-2 py-1 text-xs font-bold ring-1", statusClass(status))}>{status}</span>
                                        </td>
                                        <td className="px-4 py-3 font-semibold">{view.coverage.percentage}%</td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => setDetailsView(view)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#10A37F] hover:bg-[#10A37F]/10 dark:border-slate-700">
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">No traceability rows found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            {detailsView && <TraceabilityDetailsModal view={detailsView} onClose={() => setDetailsView(null)} />}
        </div>
    );
}
