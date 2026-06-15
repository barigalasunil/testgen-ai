"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, Eye, Search, Trash2, Link2 } from "lucide-react";
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
    api_spec: "API Spec",
    api_test_cases: "API Test Cases",
    automation_summary: "Automation Summary",
    document_metadata: "Document Metadata",
};

type MemoryVaultPanelProps = {
    onUseAsContext: (record: MemoryVaultRecord) => void;
    attachedContextId?: string | null;
};

export function MemoryVaultPanel({ onUseAsContext, attachedContextId }: MemoryVaultPanelProps) {
    const [records, setRecords] = useState<MemoryVaultRecord[]>([]);
    const [projectKey, setProjectKey] = useState("all");
    const [sourceType, setSourceType] = useState<MemorySourceType | "all">("all");
    const [query, setQuery] = useState("");
    const [viewRecord, setViewRecord] = useState<MemoryVaultRecord | null>(null);

    const refresh = () => setRecords(loadMemoryVaultRecords());

    useEffect(() => {
        refresh();
        const handler = () => refresh();
        window.addEventListener("tcgen-memory-vault-updated", handler);
        return () => window.removeEventListener("tcgen-memory-vault-updated", handler);
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
        if (!window.confirm(`Delete "${record.title}" from Memory Vault?`)) return;
        deleteMemoryVaultRecord(record.id);
        if (viewRecord?.id === record.id) setViewRecord(null);
        refresh();
    };

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
                <div className="grid grid-cols-[120px_170px_1fr_160px_220px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
                    <div>Project Key</div>
                    <div>Source Type</div>
                    <div>Title / ID</div>
                    <div>Created Date</div>
                    <div>Actions</div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredRecords.length ? filteredRecords.map(record => (
                        <article key={record.id} className="grid grid-cols-[120px_170px_1fr_160px_220px] items-center gap-3 px-4 py-3 text-sm">
                            <div className="font-bold text-[#10A37F]">{record.projectKey}</div>
                            <div className="text-gray-600 dark:text-gray-300">{sourceLabels[record.sourceType]}</div>
                            <div className="min-w-0">
                                <p className="truncate font-semibold text-gray-900 dark:text-white">{record.title}</p>
                                {attachedContextId === record.id && <p className="mt-0.5 text-xs font-semibold text-[#10A37F]">Attached to next generation</p>}
                            </div>
                            <div className="text-xs text-gray-500">{new Date(record.createdAt).toLocaleString()}</div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setViewRecord(record)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                                    <Eye className="h-3.5 w-3.5" /> View
                                </button>
                                <button onClick={() => onUseAsContext(record)} className="inline-flex items-center gap-1.5 rounded-md border border-[#10A37F]/30 px-2.5 py-1.5 text-xs font-bold text-[#10A37F] hover:bg-[#10A37F]/10">
                                    <Link2 className="h-3.5 w-3.5" /> Use as Context
                                </button>
                                <button onClick={() => handleDelete(record)} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20">
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
                            <button onClick={() => setViewRecord(null)} className="rounded-md px-2 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Close</button>
                        </div>
                        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap p-4 text-xs leading-6 text-gray-700 dark:text-gray-200">{viewRecord.content}</pre>
                    </section>
                </div>
            )}
        </div>
    );
}
