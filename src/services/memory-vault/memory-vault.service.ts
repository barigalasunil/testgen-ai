"use client";

export type MemorySourceType =
    | "jira_story"
    | "generated_test_cases"
    | "defect"
    | "api_spec"
    | "api_test_cases"
    | "automation_summary"
    | "document_metadata";

export type MemoryVaultRecord = {
    id: string;
    projectKey: string;
    sourceType: MemorySourceType;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
};

const STORAGE_KEY = "tcgen-memory-vault-v1";
const DEFAULT_PROJECT_KEY = "TCGB";

function canUseStorage() {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function normalizeProjectKey(value?: string | null) {
    const candidate = String(value || "").trim().toUpperCase();
    const fromIssue = candidate.match(/[A-Z][A-Z0-9]+-\d+/)?.[0]?.split("-")[0];
    const clean = (fromIssue || candidate).replace(/[^A-Z0-9]/g, "");
    return clean || DEFAULT_PROJECT_KEY;
}

export function projectKeyFromText(text?: string | null, fallback?: string | null) {
    const issue = String(text || "").match(/[A-Z][A-Z0-9]+-\d+/)?.[0];
    return normalizeProjectKey(issue || fallback);
}

export function loadMemoryVaultRecords(): MemoryVaultRecord[] {
    if (!canUseStorage()) return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const records = JSON.parse(raw) as MemoryVaultRecord[];
        return Array.isArray(records) ? records : [];
    } catch {
        return [];
    }
}

function saveRecords(records: MemoryVaultRecord[]) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent("tcgen-memory-vault-updated"));
}

export function upsertMemoryVaultRecord(input: Omit<MemoryVaultRecord, "id" | "createdAt" | "projectKey"> & {
    id?: string;
    projectKey?: string | null;
    createdAt?: string;
}) {
    const record: MemoryVaultRecord = {
        id: input.id || `mem-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        projectKey: normalizeProjectKey(input.projectKey),
        sourceType: input.sourceType,
        title: input.title.trim() || "Untitled Memory",
        content: input.content,
        metadata: input.metadata,
        createdAt: input.createdAt || new Date().toISOString(),
    };
    const records = loadMemoryVaultRecords();
    const next = [record, ...records.filter(item => item.id !== record.id)].slice(0, 500);
    saveRecords(next);
    return record;
}

export function deleteMemoryVaultRecord(id: string) {
    saveRecords(loadMemoryVaultRecords().filter(item => item.id !== id));
}

export function findMemoryVaultRecord(id?: string | null) {
    if (!id) return null;
    return loadMemoryVaultRecords().find(item => item.id === id) || null;
}

export function buildMemoryContextBlock(record: MemoryVaultRecord) {
    return [
        "MEMORY VAULT CONTEXT:",
        `Project Key: ${record.projectKey}`,
        `Source Type: ${record.sourceType}`,
        `Title: ${record.title}`,
        "",
        record.content.slice(0, 12000),
        "",
        "Use this Memory Vault context only when it is relevant to the current request. Do not mix project keys.",
    ].join("\n");
}
