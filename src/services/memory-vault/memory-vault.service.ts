"use client";

export type MemorySourceType =
    | "jira_story"
    | "generated_test_cases"
    | "defect"
    | "defect_converted_test_case"
    | "quality_report"
    | "api_spec"
    | "api_test_cases"
    | "automation_summary"
    | "self_healing_event"
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

export function normalizeJiraId(value?: string | null) {
    return String(value || "").trim().toUpperCase().match(/[A-Z][A-Z0-9]+-\d+/)?.[0] || "";
}

export function memoryIdForJiraStory(jiraId?: string | null) {
    const normalized = normalizeJiraId(jiraId);
    return normalized ? `mv_story_${normalized.replace("-", "_")}` : "";
}

export function memoryIdForGeneratedTestCases(jiraId?: string | null, fallbackId?: string | null) {
    const normalized = normalizeJiraId(jiraId);
    if (normalized) return `mv_testcases_${normalized.replace("-", "_")}`;
    return fallbackId ? `mv_testcases_${fallbackId.replace(/[^a-zA-Z0-9_]/g, "_")}` : "";
}

export function memoryIdForQualityReport(jiraId?: string | null, fallbackId?: string | null) {
    const normalized = normalizeJiraId(jiraId);
    if (normalized) return `mv_quality_${normalized.replace("-", "_")}`;
    return fallbackId ? `mv_quality_${fallbackId.replace(/[^a-zA-Z0-9_]/g, "_")}` : "";
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

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? Array.from(new Set(value.map(item => String(item)).filter(Boolean))) : [];
}

function normalizeTraceabilityMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
    const next = { ...(metadata || {}) };
    const storyId = normalizeJiraId(
        String(next.jiraId || next.jiraStoryId || next.generatedFromStoryId || next.storyId || next.key || "")
    );
    const testCaseIds = [
        ...asStringArray(next.linkedTestCaseIds),
        ...asStringArray(next.generatedTestCaseIds),
        String(next.testCaseId || ""),
        ...(
            Array.isArray(next.testCases)
                ? (next.testCases as { testCaseId?: unknown }[]).map(testCase => String(testCase.testCaseId || ""))
                : []
        ),
    ].filter(Boolean);
    const defectId = String(next.issueKey || next.sourceDefectId || next.defectId || "");
    const automationRunId = String(next.runId || "");

    return {
        ...next,
        linkedStoryIds: Array.from(new Set([...asStringArray(next.linkedStoryIds), storyId].filter(Boolean))),
        linkedAcceptanceCriteriaIds: asStringArray(next.linkedAcceptanceCriteriaIds),
        linkedTestCaseIds: Array.from(new Set(testCaseIds)),
        linkedDefectIds: Array.from(new Set([...asStringArray(next.linkedDefectIds), defectId].filter(Boolean))),
        linkedAutomationRunIds: Array.from(new Set([...asStringArray(next.linkedAutomationRunIds), automationRunId].filter(Boolean))),
    };
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
        metadata: normalizeTraceabilityMetadata(input.metadata),
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

export function memoryIdForDefectConvertedTestCase(defectId?: string | null) {
    const normalized = String(defectId || "").trim().toUpperCase();
    return normalized ? `mv_defect_tc_${normalized.replace(/[^A-Z0-9_]/g, "_")}` : "";
}

export function upsertDefectConvertedTestCase(input: {
    defectId?: string;
    defectUrl?: string;
    projectKey?: string | null;
    summary: string;
    description?: string;
    actualResult?: string;
    expectedResult?: string;
    priority?: string;
    severity?: string;
    storyId?: string;
    testCaseId?: string;
}) {
    const sourceDefectId = input.defectId || input.summary;
    const testCaseId = input.testCaseId || `DTC-${String(sourceDefectId).replace(/[^A-Z0-9]/gi, "-").toUpperCase()}`;
    const steps = input.description?.trim()
        ? input.description.trim()
        : [
            "1. Open the affected application area.",
            "2. Perform the action described in the defect.",
            "3. Observe the actual behavior.",
        ].join("\n");
    const expectedResult = input.expectedResult?.trim()
        || (input.actualResult?.trim()
            ? `The behavior should not match the defect actual result: ${input.actualResult.trim()}`
            : "The reported defect should not occur.");

    return upsertMemoryVaultRecord({
        id: memoryIdForDefectConvertedTestCase(input.defectId) || undefined,
        projectKey: input.projectKey || projectKeyFromText(input.storyId || input.defectId || input.summary),
        sourceType: "defect_converted_test_case",
        title: `${testCaseId} from ${sourceDefectId}`,
        content: [
            `Test Case ID: ${testCaseId}`,
            `Scenario: Verify fix for ${input.summary}`,
            "Preconditions: Defect fix is deployed and test environment is available.",
            `Steps:\n${steps}`,
            "Test Data: Use data relevant to the original defect reproduction.",
            `Expected Result: ${expectedResult}`,
            `Priority: ${input.priority || "Medium"}`,
            `Source Defect ID: ${sourceDefectId}`,
        ].join("\n\n"),
        metadata: {
            testCaseId,
            scenario: `Verify fix for ${input.summary}`,
            preconditions: "Defect fix is deployed and test environment is available.",
            steps,
            testData: "Use data relevant to the original defect reproduction.",
            expectedResult,
            priority: input.priority || "Medium",
            severity: input.severity || "",
            sourceDefectId,
            defectUrl: input.defectUrl,
            storyId: input.storyId,
            linkedMemoryStoryId: input.storyId ? memoryIdForJiraStory(input.storyId) : undefined,
            linkedMemoryDefectId: input.defectId ? `defect-${input.defectId}` : undefined,
        },
    });
}

const OLD_RUN_ID_PATTERN = /^([a-z]+)-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/;
function oldRunIdToNew(oldRunId: string): string | null {
    const match = oldRunId.match(OLD_RUN_ID_PATTERN);
    if (!match) return null;
    const suite = match[1];
    const yyyy = match[2], mm = match[3], dd = match[4];
    const hh = match[5], min = match[6];
    const capitalized = suite.charAt(0).toUpperCase() + suite.slice(1).toLowerCase();
    return `${dd}${mm}${yyyy}${hh}${min}_${capitalized}`;
}

export function migrateMemoryVaultRunNames(): number {
    if (!canUseStorage()) return 0;
    const records = loadMemoryVaultRecords();
    let migrated = 0;
    const updated = records.map(record => {
        if (record.sourceType !== "automation_summary") return record;
        const meta = record.metadata || {};
        const oldRunId = String(meta.runId || "");
        const newRunId = oldRunIdToNew(oldRunId);
        if (!newRunId || newRunId === oldRunId) return record;

        const updateUrl = (url: unknown): string | undefined => {
            const s = String(url || "");
            return s ? s.replace(oldRunId, newRunId) : undefined;
        };

        migrated++;
        return {
            ...record,
            title: record.title.replace(oldRunId, newRunId),
            metadata: {
                ...meta,
                runId: newRunId,
                playwrightReportUrl: updateUrl(meta.playwrightReportUrl),
                allureReportUrl: updateUrl(meta.allureReportUrl),
                healingReportUrl: updateUrl(meta.healingReportUrl),
                logUrl: updateUrl(meta.logUrl),
            },
        };
    });
    if (migrated > 0) saveRecords(updated);
    return migrated;
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
