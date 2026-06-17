import {
    AutomationRunRecord,
    QualityReport,
    RagasStyleScore,
    TestCase,
    TestCaseQualityScore,
    TraceabilityMatrixRow,
} from "@/src/modules/testcase-generator/types";
import { MemoryVaultRecord, memoryIdForQualityReport, normalizeJiraId, projectKeyFromText, upsertMemoryVaultRecord } from "@/src/services/memory-vault/memory-vault.service";
import { traceabilityMetadataLinks } from "@/src/services/traceability/traceability.service";

const RAGAS_UNAVAILABLE = "RAGAS Score not available — no retrieved context used.";

function clampScore(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function tokenize(text: string) {
    return Array.from(new Set(String(text).toLowerCase().match(/[a-z0-9]+/g) || []))
        .filter(token => token.length > 2 && !["the", "and", "for", "with", "that", "this", "from", "into", "then"].includes(token));
}

function overlapScore(source: string, target: string) {
    const sourceTokens = tokenize(source);
    if (sourceTokens.length === 0) return 0;
    const targetTokens = new Set(tokenize(target));
    const matched = sourceTokens.filter(token => targetTokens.has(token)).length;
    return matched / sourceTokens.length;
}

export function parseAcceptanceCriteria(text?: string) {
    const raw = String(text || "").trim();
    if (!raw) return [];
    const lines = raw
        .split(/\r?\n/)
        .map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
        .filter(Boolean);
    return lines.length > 1 ? lines : raw.split(/(?=\b(?:given|when|then|and|but|must|should|shall)\b)/i).map(item => item.trim()).filter(Boolean);
}

function caseText(testCase: TestCase) {
    return [
        testCase.scenarioTitle,
        testCase.testType,
        testCase.preconditions,
        testCase.testData,
        testCase.testSteps,
        testCase.expectedResult,
    ].join(" ");
}

function findDuplicates(testCases: TestCase[]) {
    const groups = new Map<string, TestCase[]>();
    testCases.forEach(testCase => {
        const key = tokenize(`${testCase.scenarioTitle} ${testCase.expectedResult}`).sort().join(" ");
        if (!key) return;
        groups.set(key, [...(groups.get(key) || []), testCase]);
    });
    return Array.from(groups.values())
        .filter(group => group.length > 1)
        .map(group => ({
            scenario: group[0].scenarioTitle,
            testCaseIds: group.map(item => item.testCaseId),
        }));
}

function coverageFor(needles: string[], testCases: TestCase[]) {
    if (testCases.length === 0) return 0;
    return testCases.some(testCase => needles.some(needle => caseText(testCase).toLowerCase().includes(needle))) ? 1 : 0;
}

function buildQualityScore(requirement: string, acceptanceCriteria: string[], testCases: TestCase[], duplicates: ReturnType<typeof findDuplicates>): TestCaseQualityScore {
    const corpus = testCases.map(caseText).join("\n");
    const acCoverage = acceptanceCriteria.length
        ? acceptanceCriteria.filter(ac => overlapScore(ac, corpus) >= 0.18).length / acceptanceCriteria.length
        : overlapScore(requirement, corpus);
    const positiveCoverage = coverageFor(["valid", "success", "happy", "allow", "display", "create", "update", "submit"], testCases);
    const negativeCoverage = coverageFor(["invalid", "error", "fail", "reject", "missing", "unauthorized", "negative"], testCases);
    const boundaryCoverage = coverageFor(["boundary", "minimum", "maximum", "limit", "empty", "edge", "zero", "length"], testCases);
    const duplicateDetection = testCases.length ? 1 - duplicates.reduce((sum, item) => sum + item.testCaseIds.length - 1, 0) / testCases.length : 0;
    const clarity = testCases.length
        ? testCases.filter(testCase =>
            testCase.scenarioTitle.trim().length >= 8 &&
            testCase.testSteps.trim().length >= 20 &&
            testCase.expectedResult.trim().length >= 12
        ).length / testCases.length
        : 0;
    const missingScenarioPenalty = [positiveCoverage, negativeCoverage, boundaryCoverage].filter(Boolean).length / 3;

    const scores = {
        requirementCoverage: clampScore(acCoverage * 100),
        positiveCoverage: clampScore(positiveCoverage * 100),
        negativeCoverage: clampScore(negativeCoverage * 100),
        boundaryCoverage: clampScore(boundaryCoverage * 100),
        duplicateDetection: clampScore(duplicateDetection * 100),
        clarity: clampScore(clarity * 100),
        missingScenarios: clampScore(missingScenarioPenalty * 100),
    };
    return {
        ...scores,
        overall: clampScore(
            scores.requirementCoverage * 0.3 +
            scores.positiveCoverage * 0.12 +
            scores.negativeCoverage * 0.14 +
            scores.boundaryCoverage * 0.12 +
            scores.duplicateDetection * 0.14 +
            scores.clarity * 0.12 +
            scores.missingScenarios * 0.06
        ),
    };
}

function buildRagasScore(requirement: string, answer: string, memoryContext?: MemoryVaultRecord | null): RagasStyleScore {
    if (!memoryContext) {
        return {
            available: false,
            unavailableReason: RAGAS_UNAVAILABLE,
            hallucinationRisk: "Medium",
        };
    }
    const context = `${memoryContext.title}\n${memoryContext.content}`;
    const contextRelevance = clampScore(overlapScore(requirement, context) * 100);
    const contextPrecision = clampScore(overlapScore(context, answer) * 100);
    const contextRecall = clampScore(overlapScore(answer, context) * 100);
    const faithfulness = clampScore((contextPrecision * 0.65) + (contextRecall * 0.35));
    const answerRelevance = clampScore(overlapScore(requirement, answer) * 100);
    const average = (contextRelevance + faithfulness + answerRelevance) / 3;
    return {
        available: true,
        contextRelevance,
        contextPrecision,
        contextRecall,
        faithfulness,
        answerRelevance,
        hallucinationRisk: average >= 75 ? "Low" : average >= 50 ? "Medium" : "High",
    };
}

function buildTraceability(params: {
    acceptanceCriteria: string[];
    requirement: string;
    testCases: TestCase[];
    automationRuns?: AutomationRunRecord[];
    memoryContext?: MemoryVaultRecord | null;
}) {
    const criteria = params.acceptanceCriteria.length ? params.acceptanceCriteria : [params.requirement];
    return criteria.map((criterion): TraceabilityMatrixRow => {
        const mappedCases = params.testCases.filter(testCase => overlapScore(criterion, caseText(testCase)) >= 0.18);
        return {
            acceptanceCriterion: criterion,
            testCaseIds: mappedCases.map(testCase => testCase.testCaseId),
            automationRunIds: params.automationRuns?.map(run => run.runId).filter(Boolean) || [],
            defectIds: mappedCases.map(testCase => testCase.defectId).filter(Boolean) as string[],
            memoryRecordIds: params.memoryContext ? [params.memoryContext.id] : [],
        };
    });
}

function suggestionsFor(score: TestCaseQualityScore, missingCoverage: string[], duplicates: ReturnType<typeof findDuplicates>, ragasScore: RagasStyleScore) {
    const suggestions: string[] = [];
    if (score.negativeCoverage < 80) suggestions.push("Add negative-path scenarios for invalid, missing, and unauthorized inputs.");
    if (score.boundaryCoverage < 80) suggestions.push("Add boundary scenarios for minimum, maximum, empty, and limit values.");
    if (missingCoverage.length) suggestions.push("Generate targeted cases for the unmapped acceptance criteria.");
    if (duplicates.length) suggestions.push("Merge duplicate scenarios or clarify the unique behavior each one validates.");
    if (!ragasScore.available) suggestions.push("Attach a relevant Memory Vault record before generation to enable RAGAS-style evaluation.");
    if (ragasScore.available && ragasScore.hallucinationRisk !== "Low") suggestions.push("Review low-faithfulness cases against Memory Vault context before exporting or automating.");
    return suggestions.length ? suggestions : ["Coverage is strong. Review priority and execution readiness before handoff."];
}

export function buildQualityReport(params: {
    requirement: string;
    acceptanceCriteria?: string;
    jiraStoryId?: string;
    sessionTitle?: string;
    testCases: TestCase[];
    automationRuns?: AutomationRunRecord[];
    memoryContext?: MemoryVaultRecord | null;
}) {
    const acceptanceCriteria = parseAcceptanceCriteria(params.acceptanceCriteria);
    const duplicates = findDuplicates(params.testCases);
    const qualityScore = buildQualityScore(params.requirement, acceptanceCriteria, params.testCases, duplicates);
    const answer = params.testCases.map(caseText).join("\n");
    const ragasScore = buildRagasScore(params.requirement, answer, params.memoryContext);
    const traceabilityMatrix = buildTraceability({
        acceptanceCriteria,
        requirement: params.requirement,
        testCases: params.testCases,
        automationRuns: params.automationRuns,
        memoryContext: params.memoryContext,
    });
    const missingCoverage = traceabilityMatrix
        .filter(row => row.testCaseIds.length === 0)
        .map(row => row.acceptanceCriterion);

    return {
        id: memoryIdForQualityReport(params.jiraStoryId, params.sessionTitle) || `quality-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        jiraStoryId: normalizeJiraId(params.jiraStoryId),
        requirement: params.requirement,
        acceptanceCriteria,
        qualityScore,
        ragasScore,
        traceabilityMatrix,
        acToTestCaseMapping: traceabilityMatrix,
        missingCoverage,
        duplicateScenarios: duplicates,
        improvementSuggestions: suggestionsFor(qualityScore, missingCoverage, duplicates, ragasScore),
        memoryVaultRecordIds: params.memoryContext ? [params.memoryContext.id] : [],
    } satisfies QualityReport;
}

export function formatQualityReportContent(report: QualityReport) {
    return [
        `Quality Score: ${report.qualityScore.overall}%`,
        `Requirement Coverage: ${report.qualityScore.requirementCoverage}%`,
        report.ragasScore.available
            ? `RAGAS Faithfulness: ${report.ragasScore.faithfulness}%`
            : report.ragasScore.unavailableReason,
        report.ragasScore.available ? `Context Relevance: ${report.ragasScore.contextRelevance}%` : "",
        `Hallucination Risk: ${report.ragasScore.hallucinationRisk}`,
        "",
        "AC to Test Case Mapping:",
        ...report.acToTestCaseMapping.map(row => `- ${row.acceptanceCriterion}: ${row.testCaseIds.join(", ") || "No mapped test cases"}`),
        "",
        "Missing Coverage:",
        ...(report.missingCoverage.length ? report.missingCoverage.map(item => `- ${item}`) : ["- None detected"]),
        "",
        "Duplicate Scenarios:",
        ...(report.duplicateScenarios.length ? report.duplicateScenarios.map(item => `- ${item.scenario}: ${item.testCaseIds.join(", ")}`) : ["- None detected"]),
        "",
        "Improvement Suggestions:",
        ...report.improvementSuggestions.map(item => `- ${item}`),
    ].filter(line => line !== "").join("\n");
}

export function saveQualityReportToMemory(report: QualityReport, projectText: string) {
    return upsertMemoryVaultRecord({
        id: report.id,
        projectKey: projectKeyFromText(report.jiraStoryId || projectText),
        sourceType: "quality_report",
        title: report.jiraStoryId ? `${report.jiraStoryId} Quality Report` : "Quality Report",
        content: formatQualityReportContent(report),
        metadata: {
            jiraStoryId: report.jiraStoryId,
            qualityScore: report.qualityScore,
            ragasScore: report.ragasScore,
            traceabilityMatrix: report.traceabilityMatrix,
            missingCoverage: report.missingCoverage,
            duplicateScenarios: report.duplicateScenarios,
            ...traceabilityMetadataLinks({
                storyId: report.jiraStoryId,
                acceptanceCriteriaIds: report.acceptanceCriteria.map((_, index) => `${report.jiraStoryId || "STORY"}-AC-${index + 1}`),
            }),
        },
    });
}
