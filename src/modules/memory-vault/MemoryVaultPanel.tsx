"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, Eye, Search, Trash2, Link2, X } from "lucide-react";
import {
    deleteMemoryVaultRecord,
    loadMemoryVaultRecords,
    MemorySourceType,
    MemoryVaultRecord,
} from "@/src/services/memory-vault/memory-vault.service";

const sourceLabels: Record<MemorySourceType, string> = {
    jira_story: "Jira Story",
    generated_test_cases: "Generated Test Cases",
    defect: "Defect",
    defect_converted_test_case: "Defect Converted Test Case",
    api_spec: "API Spec",
    api_test_cases: "API Test Cases",
    automation_summary: "Automation Summary",
    document_metadata: "Document Metadata",
};

type MemoryVaultPanelProps = {
    onUseAsContext: (record: MemoryVaultRecord, destination?: "testcases" | "automation" | "api-testing" | "defect-studio") => void;
    attachedContextId?: string | null;
};

export function MemoryVaultPanel({ onUseAsContext, attachedContextId }: MemoryVaultPanelProps) {
    const [records, setRecords] = useState<MemoryVaultRecord[]>([]);
    const [projectKey, setProjectKey] = useState("all");
    const [sourceType, setSourceType] = useState<MemorySourceType | "all">("all");
    const [query, setQuery] = useState("");
    const [viewRecord, setViewRecord] = useState<MemoryVaultRecord | null>(null);
    const [deleteRecord, setDeleteRecord] = useState<MemoryVaultRecord | null>(null);
    const [contextRecord, setContextRecord] = useState<MemoryVaultRecord | null>(null);

    const refresh = () => setRecords(loadMemoryVaultRecords());

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

    const projectKeys = useMemo(() => Array.from(new Set(records.map(item => item.projectKey))).sort(), [records]);

    const filteredRecords = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return records.filter(record => {
            if (projectKey !== "all" && record.projectKey !== projectKey) return false;
            if (sourceType !== "all" && record.sourceType !== sourceType) return false;
            if (!needle) return true;
            return [
                record.projectKey,
                sourceLabels[record.sourceType],
                record.title,
                record.content,
            ].join(" ").toLowerCase().includes(needle);
        });
    }, [projectKey, query, records, sourceType]);

    const handleDelete = (record: MemoryVaultRecord) => {
        deleteMemoryVaultRecord(record.id);
        if (viewRecord?.id === record.id) setViewRecord(null);
        setDeleteRecord(null);
        refresh();
    };

    const jiraIdFor = (record: MemoryVaultRecord) => String(
        record.metadata?.jiraId ||
        record.metadata?.jiraStoryId ||
        record.metadata?.generatedFromStoryId ||
        record.metadata?.storyId ||
        ""
    );

    const linkedRecordsFor = (record: MemoryVaultRecord) => {
        const jiraId = jiraIdFor(record);
        const testCaseIds = Array.isArray(record.metadata?.testCases)
            ? (record.metadata.testCases as { testCaseId?: string }[]).map(item => item.testCaseId).filter(Boolean)
            : [];
        if (record.sourceType === "jira_story") {
            return records.filter(item =>
                item.id !== record.id &&
                (item.metadata?.linkedMemoryStoryId === record.id ||
                    item.metadata?.generatedFromStoryId === jiraId ||
                    item.metadata?.storyId === jiraId ||
                    item.metadata?.jiraId === jiraId)
            );
        }
        if (record.sourceType === "generated_test_cases") {
            return records.filter(item =>
                item.id !== record.id &&
                (item.id === record.metadata?.linkedMemoryStoryId ||
                    item.metadata?.generatedTestCaseMemoryId === record.id ||
                    item.metadata?.storyId === jiraId ||
                    item.metadata?.linkedMemoryStoryId === record.metadata?.linkedMemoryStoryId ||
                    (typeof item.metadata?.testCaseId === "string" && testCaseIds.includes(item.metadata.testCaseId)))
            );
        }
        if (record.sourceType === "automation_summary") {
            const runId = String(record.metadata?.runId || "");
            return records.filter(item => item.id !== record.id && item.metadata?.runId === runId);
        }
        const linkedStoryId = String(record.metadata?.linkedMemoryStoryId || "");
        return records.filter(item =>
            item.id === linkedStoryId ||
            (item.sourceType === "jira_story" && String(item.metadata?.jiraId || item.metadata?.key || item.title) === jiraId)
        );
    };

    const linkedToLabel = (record: MemoryVaultRecord) => {
        if (record.sourceType === "generated_test_cases") {
            const jiraId = String(record.metadata?.generatedFromStoryId || record.metadata?.jiraId || record.metadata?.jiraStoryId || "");
            return jiraId ? `${jiraId} Jira Story` : "No linked story";
        }
        if (record.sourceType === "defect_converted_test_case") {
            return record.metadata?.sourceDefectId ? `${String(record.metadata.sourceDefectId)} Defect` : "Source defect";
        }
        if (record.sourceType === "jira_story") {
            const count = linkedRecordsFor(record).filter(item => item.sourceType === "generated_test_cases").length;
            return `${count} Generated Test Case Set${count === 1 ? "" : "s"}`;
        }
        const linked = linkedRecordsFor(record)[0];
        return linked ? linked.title : "None";
    };

    const linkedStats = viewRecord ? (() => {
        const linked = linkedRecordsFor(viewRecord);
        return {
            generatedTestCases: linked.filter(item => item.sourceType === "generated_test_cases").length,
            defects: linked.filter(item => item.sourceType === "defect").length,
            automationRuns: viewRecord.sourceType === "automation_summary"
                ? 1
                : linked.filter(item => item.sourceType === "automation_summary").length,
            linkedStory: viewRecord.sourceType === "generated_test_cases"
                ? linked.find(item => item.sourceType === "jira_story")?.title || String(viewRecord.metadata?.generatedFromStoryId || "")
                : "",
        };
    })() : null;

    const recordClass = (record: MemoryVaultRecord) => record.sourceType === "defect_converted_test_case"
        ? "bg-violet-50/70 dark:bg-violet-950/20"
        : "";

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-5">
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#10A37F]/10 text-[#10A37F]">
                        <Database className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Memory Vault</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Project-isolated knowledge for future test generation.</p>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[180px_220px_1fr]">
                    <select value={projectKey} onChange={event => setProjectKey(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                        <option value="all">All Projects</option>
                        {projectKeys.map(key => <option key={key} value={key}>{key}</option>)}
                    </select>
                    <select value={sourceType} onChange={event => setSourceType(event.target.value as MemorySourceType | "all")} className="h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                        <option value="all">All Source Types</option>
                        {Object.entries(sourceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search records" className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200" />
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="grid grid-cols-[110px_160px_1fr_180px_150px_220px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
                    <div>Project Key</div>
                    <div>Source Type</div>
                    <div>Title / ID</div>
                    <div>Linked To</div>
                    <div>Created Date</div>
                    <div>Actions</div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredRecords.length ? filteredRecords.map(record => (
                        <article key={record.id} className={`grid grid-cols-[110px_160px_1fr_180px_150px_220px] items-center gap-3 px-4 py-3 text-sm ${recordClass(record)}`}>
                            <div className="font-bold text-[#10A37F]">{record.projectKey}</div>
                            <div className="text-gray-600 dark:text-gray-300">{sourceLabels[record.sourceType]}</div>
                            <div className="min-w-0">
                                <p className="truncate font-semibold text-gray-900 dark:text-white">{record.title}</p>
                                {attachedContextId === record.id && <p className="mt-0.5 text-xs font-semibold text-[#10A37F]">Attached to next generation</p>}
                            </div>
                            <div className="truncate text-xs font-semibold text-gray-600 dark:text-gray-300">{linkedToLabel(record)}</div>
                            <div className="text-xs text-gray-500">{new Date(record.createdAt).toLocaleString()}</div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setViewRecord(record)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                                    <Eye className="h-3.5 w-3.5" /> View
                                </button>
                                <button onClick={() => setContextRecord(record)} className="inline-flex items-center gap-1.5 rounded-md border border-[#10A37F]/30 px-2.5 py-1.5 text-xs font-bold text-[#10A37F] hover:bg-[#10A37F]/10">
                                    <Link2 className="h-3.5 w-3.5" /> Use as Context
                                </button>
                                <button onClick={() => setDeleteRecord(record)} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20">
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </button>
                            </div>
                        </article>
                    )) : (
                        <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">No Memory Vault records found.</div>
                    )}
                </div>
            </section>

            {viewRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <section className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">{viewRecord.title}</h3>
                                <p className="mt-1 text-xs text-gray-500">{viewRecord.projectKey} - {sourceLabels[viewRecord.sourceType]}</p>
                            </div>
                            <button onClick={() => setViewRecord(null)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close view modal">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-auto">
                            {linkedStats && (
                                <div className="border-b border-gray-200 p-4 text-sm dark:border-gray-800">
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Linked Records</p>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {linkedStats.linkedStory ? (
                                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">{linkedStats.linkedStory}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Linked Jira Story</div>
                                            </div>
                                        ) : null}
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950">
                                            <div className="text-lg font-bold text-gray-900 dark:text-white">{linkedStats.generatedTestCases}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Generated Test Case Set{linkedStats.generatedTestCases === 1 ? "" : "s"}</div>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950">
                                            <div className="text-lg font-bold text-gray-900 dark:text-white">{linkedStats.defects}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Defects</div>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950">
                                            <div className="text-lg font-bold text-gray-900 dark:text-white">{linkedStats.automationRuns}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Automation Runs</div>
                                        </div>
                                    </div>
                                    {linkedRecordsFor(viewRecord).length > 0 && (
                                        <div className="mt-3 space-y-1">
                                            {linkedRecordsFor(viewRecord).map(record => (
                                                <button key={record.id} onClick={() => setViewRecord(record)} className="block w-full rounded-md px-2 py-1 text-left text-xs font-semibold text-[#10A37F] hover:bg-[#10A37F]/10">
                                                    {sourceLabels[record.sourceType]} - {record.title}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <pre className="whitespace-pre-wrap p-4 text-xs leading-6 text-gray-700 dark:text-gray-200">{viewRecord.content}</pre>
                        </div>
                    </section>
                </div>
            )}

            {deleteRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
                            <h3 className="font-bold text-gray-900 dark:text-white">Delete Memory Record</h3>
                            <button onClick={() => setDeleteRecord(null)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close delete modal"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="p-4 text-sm text-gray-600 dark:text-gray-300">
                            Delete <strong>{deleteRecord.title}</strong> from Memory Vault?
                        </div>
                        <div className="flex justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-800">
                            <button onClick={() => setDeleteRecord(null)} className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
                            <button onClick={() => handleDelete(deleteRecord)} className="h-9 rounded-lg bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700">Delete</button>
                        </div>
                    </section>
                </div>
            )}

            {contextRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
                            <h3 className="font-bold text-gray-900 dark:text-white">Use Memory Context</h3>
                            <button onClick={() => setContextRecord(null)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close context modal"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="space-y-2 p-4">
                            {[
                                { label: "QA generation", value: "testcases" },
                                { label: "Automation Hub", value: "automation" },
                                { label: "API Lab", value: "api-testing" },
                                { label: "Defect Studio", value: "defect-studio" },
                            ].map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onUseAsContext(contextRecord, option.value as "testcases" | "automation" | "api-testing" | "defect-studio");
                                        setContextRecord(null);
                                    }}
                                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-bold text-gray-700 hover:border-[#10A37F]/40 hover:bg-[#10A37F]/10 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#10A37F]/10"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end border-t border-gray-200 p-4 dark:border-gray-800">
                            <button onClick={() => setContextRecord(null)} className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
