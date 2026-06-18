"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity,
    Bug,
    Database,
    Eye,
    FileCode2,
    FileText,
    FlaskConical,
    Link2,
    Search,
    ShieldCheck,
    Trash2,
    Wrench,
    X,
} from "lucide-react";
import {
    deleteMemoryVaultRecord,
    loadMemoryVaultRecords,
    MemorySourceType,
    MemoryVaultRecord,
    migrateMemoryVaultRunNames,
} from "@/src/services/memory-vault/memory-vault.service";

const sourceLabels: Record<MemorySourceType, string> = {
    jira_story: "Story",
    generated_test_cases: "Test Cases",
    defect: "Defect",
    defect_converted_test_case: "Test Cases",
    quality_report: "Quality",
    api_spec: "API Spec",
    api_test_cases: "API Test Cases",
    automation_summary: "Automation",
    self_healing_event: "Self-Healing Event",
    document_metadata: "Document",
};

const sourceIcons: Record<MemorySourceType, typeof FileText> = {
    jira_story: FileText,
    generated_test_cases: FlaskConical,
    defect: Bug,
    defect_converted_test_case: FlaskConical,
    quality_report: ShieldCheck,
    api_spec: FileCode2,
    api_test_cases: FileCode2,
    automation_summary: Activity,
    self_healing_event: Wrench,
    document_metadata: FileText,
};

const badgeColors: Record<MemorySourceType, string> = {
    jira_story: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
    generated_test_cases: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300",
    defect: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
    defect_converted_test_case: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
    quality_report: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    api_spec: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300",
    api_test_cases: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300",
    automation_summary: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    self_healing_event: "bg-lime-50 text-lime-700 dark:bg-lime-900/20 dark:text-lime-300",
    document_metadata: "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const contextDestinations = [
    { label: "Test Case Generation", value: "testcases" },
    { label: "Automation Hub", value: "automation" },
    { label: "API Lab", value: "api-testing" },
    { label: "Defect Studio", value: "defect-studio" },
] as const;

type MemoryVaultPanelProps = {
    onUseAsContext: (record: MemoryVaultRecord, destination?: "testcases" | "automation" | "api-testing" | "defect-studio") => void;
    attachedContextId?: string | null;
};

function asArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
}

function jiraIdFor(record: MemoryVaultRecord) {
    return String(
        record.metadata?.jiraId ||
        record.metadata?.jiraStoryId ||
        record.metadata?.generatedFromStoryId ||
        record.metadata?.storyId ||
        record.metadata?.key ||
        asArray(record.metadata?.linkedStoryIds)[0] ||
        ""
    );
}

function recordPrimaryId(record: MemoryVaultRecord) {
    return jiraIdFor(record) || String(record.metadata?.issueKey || record.metadata?.runId || record.metadata?.testCaseId || record.title);
}

function compactAutomationRunId(value: string) {
    const raw = String(value || "").trim();
    const normalized = raw.match(/\d{12}_(?:Smoke|Sanity|Regression|Generated|SMK|SAN|REG)/i)?.[0] || raw;
    return normalized
        .replace(/_Smoke$/i, "_SMK")
        .replace(/_Sanity$/i, "_SAN")
        .replace(/_Regression$/i, "_REG");
}

function displayRecordId(record: MemoryVaultRecord) {
    if (record.sourceType === "automation_summary") {
        return compactAutomationRunId(String(record.metadata?.runId || recordPrimaryId(record)));
    }
    return recordPrimaryId(record);
}

function shouldShowSubtitle(record: MemoryVaultRecord, displayTitle: string) {
    if (record.sourceType === "automation_summary") return false;
    return record.title.trim() !== displayTitle.trim();
}

function compactDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return [
        String(date.getDate()).padStart(2, "0"),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getFullYear()).slice(-2),
    ].join("/");
}

function recordSearchText(record: MemoryVaultRecord) {
    return [
        record.projectKey,
        sourceLabels[record.sourceType],
        record.title,
        jiraIdFor(record),
        record.metadata?.issueKey,
        record.metadata?.summary,
        record.metadata?.scenario,
        record.metadata?.testCaseId,
        record.metadata?.runId,
        record.content,
    ].join(" ").toLowerCase();
}

function linkedRecordIds(record: MemoryVaultRecord) {
    return [
        ...asArray(record.metadata?.linkedStoryIds),
        ...asArray(record.metadata?.linkedAcceptanceCriteriaIds),
        ...asArray(record.metadata?.linkedTestCaseIds),
        ...asArray(record.metadata?.linkedDefectIds),
        ...asArray(record.metadata?.linkedAutomationRunIds),
    ];
}

function eventLabel(record: MemoryVaultRecord) {
    if (record.sourceType === "jira_story") return "Stored Jira story";
    if (record.sourceType === "generated_test_cases") return "Generated test cases";
    if (record.sourceType === "defect_converted_test_case") return "Converted defect to test case";
    if (record.sourceType === "defect") return "Created defect";
    if (record.sourceType === "automation_summary") return `Executed ${String(record.metadata?.runId || record.title || "automation")}`;
    if (record.sourceType === "self_healing_event") return `Self-healing ${String(record.metadata?.finalStatus || "event")}`;
    if (record.sourceType === "quality_report") return "Created quality report";
    if (record.sourceType === "api_spec") return "Stored API specification";
    if (record.sourceType === "api_test_cases") return "Generated API test cases";
    return "Stored document";
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="border-b border-slate-200 pb-5 last:border-b-0 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
            <div className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-200">{children}</div>
        </section>
    );
}

function MemoryDetailsModal({
    record,
    linkedRecords,
    onClose,
}: {
    record: MemoryVaultRecord;
    linkedRecords: MemoryVaultRecord[];
    onClose: () => void;
}) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const timeline = [record, ...linkedRecords]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const linkedTestCases = asArray(record.metadata?.linkedTestCaseIds);
    const linkedDefects = asArray(record.metadata?.linkedDefectIds);
    const linkedAutomationRuns = asArray(record.metadata?.linkedAutomationRunIds);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <section className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#10A37F]">{sourceLabels[record.sourceType]}</p>
                        <h2 className="mt-1 truncate text-xl font-bold text-slate-900 dark:text-white">{recordPrimaryId(record)}</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{record.title}</p>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Close details">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                    <DetailBlock title="Full Content">
                        <p className="whitespace-pre-wrap">{record.content || "No content stored."}</p>
                    </DetailBlock>

                    <DetailBlock title="Linked Jira Story">
                        <p>{jiraIdFor(record) || "No linked Jira story."}</p>
                    </DetailBlock>

                    <DetailBlock title="Linked Test Cases">
                        {linkedTestCases.length ? <p>{linkedTestCases.join(", ")}</p> : <p>No linked test cases.</p>}
                    </DetailBlock>

                    <DetailBlock title="Linked Defects">
                        {linkedDefects.length ? <p>{linkedDefects.join(", ")}</p> : <p>No linked defects.</p>}
                    </DetailBlock>

                    <DetailBlock title="Linked Automation Runs">
                        {linkedAutomationRuns.length ? <p>{linkedAutomationRuns.join(", ")}</p> : <p>No linked automation runs.</p>}
                    </DetailBlock>

                    <DetailBlock title="Related Memory Vault Records">
                        {linkedRecords.length ? (
                            <ul className="space-y-2">
                                {linkedRecords.map(item => (
                                    <li key={item.id}><strong>{sourceLabels[item.sourceType]}</strong> - {item.title}</li>
                                ))}
                            </ul>
                        ) : <p>No related records found.</p>}
                    </DetailBlock>

                    <DetailBlock title="Timeline">
                        <div className="border-l border-slate-200 pl-4 dark:border-slate-800">
                            {timeline.map(item => (
                                <div key={item.id} className="relative pb-4">
                                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#10A37F] dark:border-slate-950" />
                                    <p className="text-xs font-bold text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">{eventLabel(item)}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.title}</p>
                                </div>
                            ))}
                        </div>
                    </DetailBlock>
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

export function MemoryVaultPanel({ onUseAsContext, attachedContextId }: MemoryVaultPanelProps) {
    const [records, setRecords] = useState<MemoryVaultRecord[]>([]);
    const [projectKey, setProjectKey] = useState("all");
    const [sourceType, setSourceType] = useState<MemorySourceType | "all">("all");
    const [query, setQuery] = useState("");
    const [viewRecord, setViewRecord] = useState<MemoryVaultRecord | null>(null);
    const [deleteRecord, setDeleteRecord] = useState<MemoryVaultRecord | null>(null);
    const [contextRecord, setContextRecord] = useState<MemoryVaultRecord | null>(null);

    const refresh = () => {
        migrateMemoryVaultRunNames();
        setRecords(loadMemoryVaultRecords());
    };

    useEffect(() => {
        const timeout = window.setTimeout(() => refresh(), 0);
        const handler = () => refresh();
        window.addEventListener("tcgen-memory-vault-updated", handler);
        return () => {
            window.clearTimeout(timeout);
            window.removeEventListener("tcgen-memory-vault-updated", handler);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setViewRecord(null);
            setDeleteRecord(null);
            setContextRecord(null);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const projectOptions = useMemo(() => {
        return Array.from(new Set(records.map(record => record.projectKey).filter(Boolean))).sort();
    }, [records]);

    const filteredRecords = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return records.filter(record => {
            if (projectKey !== "all" && record.projectKey !== projectKey) return false;
            if (sourceType !== "all" && record.sourceType !== sourceType) return false;
            if (!needle) return true;
            return recordSearchText(record).includes(needle);
        });
    }, [projectKey, query, records, sourceType]);

    const linkedRecordsFor = useCallback((record: MemoryVaultRecord) => {
        const jiraId = jiraIdFor(record);
        const ids = new Set(linkedRecordIds(record));
        const linkedStoryId = String(record.metadata?.linkedMemoryStoryId || "");
        const generatedTestCaseMemoryId = String(record.metadata?.generatedTestCaseMemoryId || "");
        return records.filter(item => {
            if (item.id === record.id) return false;
            if (item.id === linkedStoryId || item.id === generatedTestCaseMemoryId) return true;
            if (item.metadata?.linkedMemoryStoryId === record.id) return true;
            if (item.metadata?.generatedTestCaseMemoryId === record.id) return true;
            if (ids.has(recordPrimaryId(item)) || ids.has(item.id)) return true;
            if (jiraId && (
                item.metadata?.jiraId === jiraId ||
                item.metadata?.jiraStoryId === jiraId ||
                item.metadata?.storyId === jiraId ||
                item.metadata?.generatedFromStoryId === jiraId ||
                item.title.includes(jiraId)
            )) return true;
            return false;
        });
    }, [records]);

    const handleDelete = (record: MemoryVaultRecord) => {
        deleteMemoryVaultRecord(record.id);
        setDeleteRecord(null);
        refresh();
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-white text-slate-900 dark:bg-gray-950 dark:text-slate-100">
            <header className="border-b border-slate-200 px-4 py-4 dark:border-slate-800 md:px-6">
                <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-[#10A37F]" />
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Memory Vault</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Searchable knowledge index for stories, test assets, defects, runs, and reports.</p>
                    </div>
                </div>
            </header>

            <section className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 md:px-6">
                <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_180px_240px]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="Search Memory Vault"
                            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#10A37F] dark:border-slate-700 dark:bg-slate-950"
                        />
                    </div>
                    <select
                        value={projectKey}
                        onChange={event => setProjectKey(event.target.value)}
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#10A37F] dark:border-slate-700 dark:bg-slate-950"
                    >
                        <option value="all">All Projects</option>
                        {projectOptions.map(project => <option key={project} value={project}>{project}</option>)}
                    </select>
                    <select
                        value={sourceType}
                        onChange={event => setSourceType(event.target.value as MemorySourceType | "all")}
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#10A37F] dark:border-slate-700 dark:bg-slate-950"
                    >
                        <option value="all">All Source Types</option>
                        {Object.entries(sourceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                </div>
            </section>

            <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full max-w-[876px] table-fixed divide-y divide-slate-100 text-sm dark:divide-slate-800/50">
                        <colgroup>
                            <col className="w-[70px]" />
                            <col className="w-[150px]" />
                            <col className="w-[260px] max-w-[280px]" />
                            <col className="w-[130px]" />
                            <col className="w-[70px]" />
                            <col className="w-[100px]" />
                            <col className="w-[96px] max-w-[96px]" />
                        </colgroup>
                        <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
                            <tr>
                                <th className="w-[70px] px-2 py-2.5 align-middle">Key</th>
                                <th className="w-[150px] px-2 py-2.5 align-middle">Type</th>
                                <th className="w-[260px] max-w-[280px] px-3 py-2.5 align-middle">Title / ID</th>
                                <th className="w-[130px] px-2 py-2.5 align-middle">Linked Story</th>
                                <th className="w-[70px] px-2 py-2.5 align-middle">Links</th>
                                <th className="w-[100px] px-2 py-2.5 align-middle">Date</th>
                                <th className="sticky right-0 w-[96px] max-w-[96px] bg-slate-50 px-2 py-2.5 align-middle dark:bg-slate-900/70">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800/30 dark:bg-slate-950">
                            {filteredRecords.length ? filteredRecords.map(record => {
                                const Icon = sourceIcons[record.sourceType];
                                const linkedCount = linkedRecordsFor(record).length;
                                const displayTitle = displayRecordId(record);
                                const linkedStory = jiraIdFor(record);
                                return (
                                    <tr key={record.id} className="group h-[44px] hover:bg-slate-50 dark:hover:bg-slate-900/40">
                                        <td className="truncate px-2 py-1 align-middle text-xs font-semibold text-slate-700 dark:text-slate-300" title={record.projectKey}>{record.projectKey}</td>
                                        <td className="px-2 py-1 align-middle">
                                            <span className={`inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 ${badgeColors[record.sourceType]}`}>
                                                <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                <span className="truncate">{sourceLabels[record.sourceType]}</span>
                                            </span>
                                        </td>
                                        <td className="max-w-[280px] px-3 py-1 align-middle">
                                            <div className="truncate text-[13px] font-semibold leading-4 text-slate-900 dark:text-white" title={displayTitle}>{displayTitle}</div>
                                            {shouldShowSubtitle(record, displayTitle) ? (
                                                <div className="truncate text-[11px] leading-3 text-slate-500 dark:text-slate-400" title={record.title}>{record.title}</div>
                                            ) : null}
                                            {attachedContextId === record.id ? <div className="mt-0.5 text-[10px] font-bold leading-3 text-[#10A37F]">Context Attached</div> : null}
                                        </td>
                                        <td className="truncate px-2 py-1 align-middle text-xs text-slate-600 dark:text-slate-400" title={linkedStory || "—"}>{linkedStory || "—"}</td>
                                        <td className="px-2 py-1 align-middle">
                                            {linkedCount > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                                                    {linkedCount}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-500 dark:text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1 align-middle text-xs text-slate-500 dark:text-slate-400">{new Date(record.createdAt).toLocaleDateString()}</td>
                                        <td className="sticky right-0 max-w-[96px] bg-white px-2 py-1 align-middle dark:bg-slate-950">
                                            <div className="ml-auto flex w-fit items-center justify-end gap-1">
                                                <button onClick={() => setViewRecord(record)} className="inline-flex h-7 w-7 items-center justify-center rounded p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" title="View details">
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => setContextRecord(record)} className="inline-flex h-7 w-7 items-center justify-center rounded p-0 text-slate-500 hover:bg-slate-100 hover:text-[#10A37F] dark:hover:bg-slate-800 dark:hover:text-[#10A37F]" title="Use as context">
                                                    <Link2 className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => setDeleteRecord(record)} className="inline-flex h-7 w-7 items-center justify-center rounded p-0 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400" title="Delete record">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">No Memory Vault records found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            {viewRecord && (
                <MemoryDetailsModal
                    record={viewRecord}
                    linkedRecords={linkedRecordsFor(viewRecord)}
                    onClose={() => setViewRecord(null)}
                />
            )}

            {deleteRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white">Delete Memory Record</h3>
                            <button onClick={() => setDeleteRecord(null)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Close delete modal"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="p-4 text-sm text-slate-600 dark:text-slate-300">
                            Delete <strong>{deleteRecord.title}</strong> from Memory Vault?
                        </div>
                        <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
                            <button onClick={() => setDeleteRecord(null)} className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">Cancel</button>
                            <button onClick={() => handleDelete(deleteRecord)} className="h-9 rounded-lg bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700">Delete</button>
                        </div>
                    </section>
                </div>
            )}

            {contextRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white">Use Memory Context</h3>
                            <button onClick={() => setContextRecord(null)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Close context modal"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="border-b border-slate-200 p-4 text-sm dark:border-slate-800">
                            <p className="font-semibold text-slate-900 dark:text-white">Attach To</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Context Attached: {recordPrimaryId(contextRecord)}</p>
                        </div>
                        <div className="space-y-2 p-4">
                            {contextDestinations.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onUseAsContext(contextRecord, option.value);
                                        setContextRecord(null);
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-bold text-slate-700 hover:border-[#10A37F]/40 hover:bg-[#10A37F]/10 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-[#10A37F]/10"
                                >
                                    <span className="h-3 w-3 rounded-full border border-slate-400" />
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end border-t border-slate-200 p-4 dark:border-slate-800">
                            <button onClick={() => setContextRecord(null)} className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">Cancel</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
