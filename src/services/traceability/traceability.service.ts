"use client";

import type { TestCase } from "@/src/modules/testcase-generator/types";
import {
    loadMemoryVaultRecords,
    MemoryVaultRecord,
    memoryIdForJiraStory,
    normalizeJiraId,
    normalizeProjectKey,
    projectKeyFromText,
} from "@/src/services/memory-vault/memory-vault.service";

export type CoverageStatus = "Covered" | "Partial" | "Missing";

export type TraceabilityStory = {
    storyId: string;
    jiraId: string;
    projectKey: string;
    summary: string;
    description: string;
};

export type AcceptanceCriterion = {
    acId: string;
    storyId: string;
    title: string;
    description: string;
};

export type TraceabilityTestCase = {
    tcId: string;
    storyId: string;
    linkedAcceptanceCriteriaIds: string[];
    title: string;
};

export type TraceabilityDefect = {
    defectId: string;
    storyId: string;
    sourceTestCaseId?: string;
    summary: string;
};

export type TraceabilityAutomationRun = {
    runId: string;
    storyId: string;
    linkedTestCaseIds: string[];
    suite?: string;
    passed?: number;
    failed?: number;
    status?: string;
    healingAttempted?: boolean;
    healingStatus?: string;
    healedScriptPath?: string;
};

export type TraceabilityQualityReport = {
    reportId: string;
    storyId: string;
    coverage?: number;
};

export type TraceabilityApiAsset = {
    assetId: string;
    storyId: string;
    title: string;
};

export type TraceabilityRecord = {
    stories: TraceabilityStory[];
    acceptanceCriteria: AcceptanceCriterion[];
    testCases: TraceabilityTestCase[];
    defects: TraceabilityDefect[];
    automationRuns: TraceabilityAutomationRun[];
    qualityReports: TraceabilityQualityReport[];
    apiAssets: TraceabilityApiAsset[];
};

export type AcceptanceCoverage = AcceptanceCriterion & {
    status: CoverageStatus;
    testCases: TraceabilityTestCase[];
    defects: TraceabilityDefect[];
    automationRuns: TraceabilityAutomationRun[];
};

export type TraceabilityStoryView = TraceabilityStory & {
    acceptanceCriteria: AcceptanceCoverage[];
    linkedAssets: {
        generatedTestCases: TraceabilityTestCase[];
        defects: TraceabilityDefect[];
        automationRuns: TraceabilityAutomationRun[];
        apiAssets: TraceabilityApiAsset[];
        qualityReports: TraceabilityQualityReport[];
    };
    coverage: {
        covered: number;
        partial: number;
        missing: number;
        total: number;
        percentage: number;
    };
};

export type TraceabilityReport = {
    generatedAt: string;
    rows: {
        story: string;
        acceptanceCriteriaCount: number;
        coveredCount: number;
        partialCount: number;
        missingCount: number;
        generatedTestCases: number;
        defects: number;
        automationRuns: number;
        coveragePercentage: number;
    }[];
};

export type FutureTraceabilityExtension = {
    id: "quality-intelligence" | "ragas" | "impact-analysis" | "self-healing-history";
    label: string;
    reads: string[];
    writes: string[];
};

const STORAGE_KEY = "tcgen-traceability-v1";

export const traceabilityExtensions: FutureTraceabilityExtension[] = [
    {
        id: "quality-intelligence",
        label: "Quality Intelligence",
        reads: ["stories", "acceptanceCriteria", "testCases", "defects", "automationRuns", "qualityReports"],
        writes: ["qualitySignals"],
    },
    {
        id: "ragas",
        label: "RAGAS",
        reads: ["memoryVaultLinks", "acceptanceCriteria", "qualityReports"],
        writes: ["retrievalScores"],
    },
    {
        id: "impact-analysis",
        label: "Impact Analysis",
        reads: ["storyToAssetGraph", "automationRuns", "defects"],
        writes: ["impactedAssets"],
    },
    {
        id: "self-healing-history",
        label: "Self-Healing History",
        reads: ["automationRuns", "qualityReports"],
        writes: ["healingEvents"],
    },
];

function canUseStorage() {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emptyRecord(): TraceabilityRecord {
    return {
        stories: [],
        acceptanceCriteria: [],
        testCases: [],
        defects: [],
        automationRuns: [],
        qualityReports: [],
        apiAssets: [],
    };
}

function loadStoredTraceability(): TraceabilityRecord {
    if (!canUseStorage()) return emptyRecord();
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return emptyRecord();
        return { ...emptyRecord(), ...JSON.parse(raw) } as TraceabilityRecord;
    } catch {
        return emptyRecord();
    }
}

function saveTraceability(record: TraceabilityRecord) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent("tcgen-traceability-updated"));
}

function unique<T>(items: T[]) {
    return Array.from(new Set(items.filter(Boolean)));
}

function normalizeArray(value: unknown): string[] {
    return Array.isArray(value) ? unique(value.map(item => String(item)).filter(Boolean)) : [];
}

function toText(value: unknown) {
    return String(value || "").trim();
}

function tokenize(text: string) {
    return Array.from(new Set(text.toLowerCase().match(/[a-z0-9]+/g) || []))
        .filter(token => token.length > 2 && !["the", "and", "for", "with", "that", "this", "from", "into", "then", "when", "given"].includes(token));
}

function overlapScore(source: string, target: string) {
    const sourceTokens = tokenize(source);
    if (!sourceTokens.length) return 0;
    const targetTokens = new Set(tokenize(target));
    return sourceTokens.filter(token => targetTokens.has(token)).length / sourceTokens.length;
}

function testCaseText(testCase: TestCase) {
    return [
        testCase.testCaseId,
        testCase.scenarioTitle,
        testCase.preconditions,
        testCase.testData,
        testCase.testSteps,
        testCase.expectedResult,
    ].join(" ");
}

export function extractAcceptanceCriteria(text?: string, storyId?: string): AcceptanceCriterion[] {
    const raw = String(text || "").trim();
    const fallbackDescription = "General Requirement Coverage Group";
    const lines = raw
        ? raw
            .split(/\r?\n/)
            .map(line => line.replace(/^\s*(?:[-*]|\d+[.)]|AC[-\s]?\d+[:.)]?)\s*/i, "").trim())
            .filter(Boolean)
        : [];
    const candidates = lines.length > 1
        ? lines
        : raw
            ? raw.split(/(?=\b(?:given|when|then|and|but|must|should|shall|user can|system must)\b)/i).map(item => item.trim()).filter(Boolean)
            : [fallbackDescription];
    const normalizedStoryId = normalizeJiraId(storyId) || storyId || "STORY";
    return candidates.map((description, index) => ({
        acId: `${normalizedStoryId}-AC-${index + 1}`,
        storyId: normalizedStoryId,
        title: description.length > 80 ? `${description.slice(0, 77)}...` : description,
        description,
    }));
}

function upsertById<T>(items: T[], next: T, idFor: (item: T) => string) {
    return [next, ...items.filter(item => idFor(item) !== idFor(next))];
}

export function upsertStoryTraceability(input: {
    storyId: string;
    summary?: string;
    description?: string;
    acceptanceCriteria?: string;
    projectKey?: string | null;
}) {
    const jiraId = normalizeJiraId(input.storyId);
    if (!jiraId) return;
    const projectKey = normalizeProjectKey(input.projectKey || projectKeyFromText(jiraId));
    const record = loadStoredTraceability();
    const story: TraceabilityStory = {
        storyId: jiraId,
        jiraId,
        projectKey,
        summary: input.summary || jiraId,
        description: input.description || "",
    };
    const criteria = extractAcceptanceCriteria(input.acceptanceCriteria, jiraId);
    saveTraceability({
        ...record,
        stories: upsertById(record.stories, story, item => item.storyId),
        acceptanceCriteria: [
            ...criteria,
            ...record.acceptanceCriteria.filter(item => item.storyId !== jiraId),
        ],
    });
}

export function mapTestCaseToAcceptanceCriteria(testCase: TestCase, criteria: AcceptanceCriterion[]) {
    const explicit = normalizeArray(testCase.linkedAcceptanceCriteriaIds).filter(id => criteria.some(ac => ac.acId === id));
    if (explicit.length) return explicit;
    const text = testCaseText(testCase);
    const ranked = criteria
        .map(ac => ({ ac, score: overlapScore(ac.description, text) }))
        .filter(item => item.score >= 0.15)
        .sort((a, b) => b.score - a.score);
    return ranked.length ? ranked.slice(0, 2).map(item => item.ac.acId) : criteria.slice(0, 1).map(ac => ac.acId);
}

export function linkGeneratedTestCases(params: {
    storyId?: string;
    projectKey?: string | null;
    testCases: TestCase[];
}) {
    const storyId = normalizeJiraId(params.storyId);
    if (!storyId || !params.testCases.length) return;
    const record = loadStoredTraceability();
    const criteria = record.acceptanceCriteria.filter(ac => ac.storyId === storyId);
    const nextCases = params.testCases.map(testCase => ({
        tcId: testCase.testCaseId,
        storyId,
        linkedAcceptanceCriteriaIds: mapTestCaseToAcceptanceCriteria(testCase, criteria),
        title: testCase.scenarioTitle,
    }));
    saveTraceability({
        ...record,
        testCases: [
            ...nextCases,
            ...record.testCases.filter(item => item.storyId !== storyId || !nextCases.some(next => next.tcId === item.tcId)),
        ],
    });
}

export function linkDefectTraceability(params: {
    defectId?: string;
    storyId?: string;
    sourceTestCaseId?: string;
    summary?: string;
}) {
    const storyId = normalizeJiraId(params.storyId);
    const defectId = toText(params.defectId || params.summary);
    if (!storyId || !defectId) return;
    const record = loadStoredTraceability();
    saveTraceability({
        ...record,
        defects: upsertById(record.defects, {
            defectId,
            storyId,
            sourceTestCaseId: params.sourceTestCaseId,
            summary: params.summary || defectId,
        }, item => item.defectId),
    });
}

export function linkAutomationRunTraceability(params: {
    runId?: string;
    storyId?: string;
    linkedTestCaseIds?: string[];
    suite?: string;
    passed?: number;
    failed?: number;
    status?: string;
    healingAttempted?: boolean;
    healingStatus?: string;
    healedScriptPath?: string;
}) {
    const storyId = normalizeJiraId(params.storyId);
    const runId = toText(params.runId);
    if (!storyId || !runId) return;
    const record = loadStoredTraceability();
    saveTraceability({
        ...record,
        automationRuns: upsertById(record.automationRuns, {
            runId,
            storyId,
            linkedTestCaseIds: unique(params.linkedTestCaseIds || []),
            suite: params.suite,
            passed: params.passed,
            failed: params.failed,
            status: params.status,
            healingAttempted: params.healingAttempted,
            healingStatus: params.healingStatus,
            healedScriptPath: params.healedScriptPath,
        }, item => item.runId),
    });
}

function storyIdForRecord(record: MemoryVaultRecord) {
    return normalizeJiraId(
        toText(record.metadata?.jiraId) ||
        toText(record.metadata?.jiraStoryId) ||
        toText(record.metadata?.generatedFromStoryId) ||
        toText(record.metadata?.storyId) ||
        toText(record.metadata?.key) ||
        record.title
    );
}

function testCasesFromMemory(record: MemoryVaultRecord): TestCase[] {
    const fromMetadata = record.metadata?.testCases;
    if (Array.isArray(fromMetadata)) return fromMetadata as TestCase[];
    try {
        const parsed = JSON.parse(record.content);
        return Array.isArray(parsed) ? parsed as TestCase[] : [];
    } catch {
        return [];
    }
}

function mergeFromMemory(stored: TraceabilityRecord, records: MemoryVaultRecord[]): TraceabilityRecord {
    const merged: TraceabilityRecord = {
        stories: [...stored.stories],
        acceptanceCriteria: [...stored.acceptanceCriteria],
        testCases: [...stored.testCases],
        defects: [...stored.defects],
        automationRuns: [...stored.automationRuns],
        qualityReports: [...stored.qualityReports],
        apiAssets: [...stored.apiAssets],
    };

    records.forEach(record => {
        const storyId = storyIdForRecord(record);
        if (!storyId) return;
        const projectKey = normalizeProjectKey(record.projectKey || projectKeyFromText(storyId));

        if (record.sourceType === "jira_story") {
            const summary = toText(record.metadata?.summary) || record.title;
            const description = toText(record.metadata?.description) || record.content;
            merged.stories = upsertById(merged.stories, { storyId, jiraId: storyId, projectKey, summary, description }, item => item.storyId);
            if (!merged.acceptanceCriteria.some(ac => ac.storyId === storyId)) {
                merged.acceptanceCriteria = [
                    ...extractAcceptanceCriteria(toText(record.metadata?.acceptanceCriteria), storyId),
                    ...merged.acceptanceCriteria,
                ];
            }
        }

        if (record.sourceType === "generated_test_cases" || record.sourceType === "defect_converted_test_case") {
            const criteria = merged.acceptanceCriteria.filter(ac => ac.storyId === storyId);
            const cases = testCasesFromMemory(record);
            const nextCases = cases.length
                ? cases.map(testCase => ({
                    tcId: testCase.testCaseId || toText(record.metadata?.testCaseId),
                    storyId,
                    linkedAcceptanceCriteriaIds: normalizeArray(record.metadata?.linkedAcceptanceCriteriaIds).length
                        ? normalizeArray(record.metadata?.linkedAcceptanceCriteriaIds)
                        : mapTestCaseToAcceptanceCriteria(testCase, criteria),
                    title: testCase.scenarioTitle || record.title,
                }))
                : [{
                    tcId: toText(record.metadata?.testCaseId) || record.title,
                    storyId,
                    linkedAcceptanceCriteriaIds: normalizeArray(record.metadata?.linkedAcceptanceCriteriaIds),
                    title: toText(record.metadata?.scenario) || record.title,
                }];
            merged.testCases = [
                ...nextCases.filter(item => item.tcId),
                ...merged.testCases.filter(item => !nextCases.some(next => next.tcId && next.tcId === item.tcId)),
            ];
        }

        if (record.sourceType === "defect") {
            const defectId = toText(record.metadata?.issueKey) || record.title;
            merged.defects = upsertById(merged.defects, {
                defectId,
                storyId,
                sourceTestCaseId: toText(record.metadata?.sourceTestCaseId) || toText(record.metadata?.testCaseId) || undefined,
                summary: toText(record.metadata?.summary) || record.title,
            }, item => item.defectId);
        }

        if (record.sourceType === "automation_summary") {
            const runId = toText(record.metadata?.runId) || record.title;
            merged.automationRuns = upsertById(merged.automationRuns, {
                runId,
                storyId,
                linkedTestCaseIds: normalizeArray(record.metadata?.linkedTestCaseIds).length
                    ? normalizeArray(record.metadata?.linkedTestCaseIds)
                    : normalizeArray(record.metadata?.generatedTestCaseIds),
                suite: toText(record.metadata?.suite) || undefined,
                passed: Number(record.metadata?.passed ?? 0),
                failed: Number(record.metadata?.failed ?? 0),
                status: toText(record.metadata?.status) || undefined,
                healingAttempted: Boolean(record.metadata?.healingAttempted),
                healingStatus: toText(record.metadata?.healingStatus) || undefined,
                healedScriptPath: toText(record.metadata?.healedScriptPath) || undefined,
            }, item => item.runId);
        }

        if (record.sourceType === "self_healing_event") {
            const runId = toText(record.metadata?.runId) || toText(record.metadata?.linkedAutomationRunId);
            if (runId) {
                merged.automationRuns = upsertById(merged.automationRuns, {
                    runId,
                    storyId,
                    linkedTestCaseIds: normalizeArray(record.metadata?.linkedTestCaseIds),
                    suite: toText(record.metadata?.suite) || undefined,
                    failed: 1,
                    status: "failed",
                    healingAttempted: true,
                    healingStatus: toText(record.metadata?.finalStatus) || undefined,
                    healedScriptPath: toText(record.metadata?.healedScriptPath) || undefined,
                }, item => item.runId);
            }
        }

        if (record.sourceType === "quality_report") {
            merged.qualityReports = upsertById(merged.qualityReports, {
                reportId: record.id,
                storyId,
                coverage: Number((record.metadata?.qualityScore as { requirementCoverage?: number } | undefined)?.requirementCoverage || 0),
            }, item => item.reportId);
        }

        if (record.sourceType === "api_spec" || record.sourceType === "api_test_cases") {
            merged.apiAssets = upsertById(merged.apiAssets, {
                assetId: record.id,
                storyId,
                title: record.title,
            }, item => item.assetId);
        }
    });

    const storyIds = new Set(merged.stories.map(story => story.storyId));
    records.forEach(record => {
        const storyId = storyIdForRecord(record);
        if (storyId && !storyIds.has(storyId)) {
            merged.stories = upsertById(merged.stories, {
                storyId,
                jiraId: storyId,
                projectKey: normalizeProjectKey(record.projectKey),
                summary: storyId,
                description: record.content,
            }, item => item.storyId);
            if (!merged.acceptanceCriteria.some(ac => ac.storyId === storyId)) {
                merged.acceptanceCriteria = [...extractAcceptanceCriteria("", storyId), ...merged.acceptanceCriteria];
            }
        }
    });

    return merged;
}

export function loadTraceabilityRecord() {
    return mergeFromMemory(loadStoredTraceability(), loadMemoryVaultRecords());
}

export function buildStoryView(storyId: string, source: TraceabilityRecord = loadTraceabilityRecord()): TraceabilityStoryView | null {
    const normalized = normalizeJiraId(storyId);
    const story = source.stories.find(item => item.storyId === normalized || item.jiraId === normalized);
    if (!story) return null;
    const criteria = source.acceptanceCriteria.filter(ac => ac.storyId === story.storyId);
    const testCases = source.testCases.filter(testCase => testCase.storyId === story.storyId);
    const defects = source.defects.filter(defect => defect.storyId === story.storyId);
    const automationRuns = source.automationRuns.filter(run => run.storyId === story.storyId);

    const acceptanceCriteria = criteria.map(ac => {
        const acCases = testCases.filter(testCase => testCase.linkedAcceptanceCriteriaIds.includes(ac.acId));
        const acDefects = defects.filter(defect => !defect.sourceTestCaseId || acCases.some(testCase => testCase.tcId === defect.sourceTestCaseId));
        const acRuns = automationRuns.filter(run => run.linkedTestCaseIds.length === 0 || acCases.some(testCase => run.linkedTestCaseIds.includes(testCase.tcId)));
        let status: CoverageStatus = "Missing";
        if (acCases.length && acRuns.length) status = "Covered";
        else if (acCases.length || acDefects.length || acRuns.length) status = "Partial";
        return {
            ...ac,
            status,
            testCases: acCases,
            defects: acDefects,
            automationRuns: acRuns,
        };
    });

    const covered = acceptanceCriteria.filter(item => item.status === "Covered").length;
    const partial = acceptanceCriteria.filter(item => item.status === "Partial").length;
    const missing = acceptanceCriteria.filter(item => item.status === "Missing").length;
    const total = acceptanceCriteria.length;
    return {
        ...story,
        acceptanceCriteria,
        linkedAssets: {
            generatedTestCases: testCases,
            defects,
            automationRuns,
            apiAssets: source.apiAssets.filter(asset => asset.storyId === story.storyId),
            qualityReports: source.qualityReports.filter(report => report.storyId === story.storyId),
        },
        coverage: {
            covered,
            partial,
            missing,
            total,
            percentage: total ? Math.round(((covered + partial * 0.5) / total) * 100) : 0,
        },
    };
}

export function buildTraceabilityReport(source: TraceabilityRecord = loadTraceabilityRecord()): TraceabilityReport {
    return {
        generatedAt: new Date().toISOString(),
        rows: source.stories.map(story => {
            const view = buildStoryView(story.storyId, source);
            return {
                story: story.jiraId,
                acceptanceCriteriaCount: view?.coverage.total || 0,
                coveredCount: view?.coverage.covered || 0,
                partialCount: view?.coverage.partial || 0,
                missingCount: view?.coverage.missing || 0,
                generatedTestCases: view?.linkedAssets.generatedTestCases.length || 0,
                defects: view?.linkedAssets.defects.length || 0,
                automationRuns: view?.linkedAssets.automationRuns.length || 0,
                coveragePercentage: view?.coverage.percentage || 0,
            };
        }),
    };
}

export function searchTraceability(source: TraceabilityRecord, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return source.stories;
    const matchingStoryIds = new Set<string>();
    source.stories.forEach(story => {
        if ([story.storyId, story.jiraId, story.summary, story.description].join(" ").toLowerCase().includes(q)) {
            matchingStoryIds.add(story.storyId);
        }
    });
    source.testCases.forEach(testCase => {
        if ([testCase.tcId, testCase.title].join(" ").toLowerCase().includes(q)) matchingStoryIds.add(testCase.storyId);
    });
    source.defects.forEach(defect => {
        if ([defect.defectId, defect.summary, defect.sourceTestCaseId].join(" ").toLowerCase().includes(q)) matchingStoryIds.add(defect.storyId);
    });
    source.automationRuns.forEach(run => {
        if ([run.runId, run.suite, ...run.linkedTestCaseIds].join(" ").toLowerCase().includes(q)) matchingStoryIds.add(run.storyId);
    });
    return source.stories.filter(story => matchingStoryIds.has(story.storyId));
}

export function exportTraceabilityJson(report: TraceabilityReport) {
    return JSON.stringify(report, null, 2);
}

export function exportTraceabilityCsv(report: TraceabilityReport) {
    const headers = [
        "Story",
        "Acceptance Criteria Count",
        "Covered Count",
        "Partial Count",
        "Missing Count",
        "Generated Test Cases",
        "Defects",
        "Automation Runs",
        "Coverage %",
    ];
    const rows = report.rows.map(row => [
        row.story,
        row.acceptanceCriteriaCount,
        row.coveredCount,
        row.partialCount,
        row.missingCount,
        row.generatedTestCases,
        row.defects,
        row.automationRuns,
        row.coveragePercentage,
    ]);
    return [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
}

export function traceabilityDownload(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function exportTraceabilityPdf(report: TraceabilityReport) {
    const rows = report.rows.map(row => `
        <tr>
            <td>${row.story}</td>
            <td>${row.acceptanceCriteriaCount}</td>
            <td>${row.coveredCount}</td>
            <td>${row.partialCount}</td>
            <td>${row.missingCount}</td>
            <td>${row.generatedTestCases}</td>
            <td>${row.defects}</td>
            <td>${row.automationRuns}</td>
            <td>${row.coveragePercentage}%</td>
        </tr>
    `).join("");
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) return;
    popup.document.write(`
        <html>
            <head>
                <title>Traceability Report</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; }
                    h1 { font-size: 22px; margin-bottom: 4px; }
                    p { color: #475569; margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 12px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                    th { background: #f1f5f9; }
                </style>
            </head>
            <body>
                <h1>TCGen-Buddy Traceability Report</h1>
                <p>Generated ${report.generatedAt}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Story</th><th>Acceptance Criteria Count</th><th>Covered</th><th>Partial</th><th>Missing</th>
                            <th>Test Cases Count</th><th>Defects Count</th><th>Automation Runs Count</th><th>Coverage</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </body>
        </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
}

export function traceabilityMetadataLinks(input: {
    storyId?: string;
    acceptanceCriteriaIds?: string[];
    testCaseIds?: string[];
    defectIds?: string[];
    automationRunIds?: string[];
}) {
    const storyId = normalizeJiraId(input.storyId);
    return {
        linkedStoryIds: storyId ? [storyId] : [],
        linkedAcceptanceCriteriaIds: unique(input.acceptanceCriteriaIds || []),
        linkedTestCaseIds: unique(input.testCaseIds || []),
        linkedDefectIds: unique(input.defectIds || []),
        linkedAutomationRunIds: unique(input.automationRunIds || []),
        linkedMemoryStoryId: storyId ? memoryIdForJiraStory(storyId) : undefined,
    };
}
