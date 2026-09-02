import { AiProviderId } from "@/src/services/ai/provider-orchestrator";

export type TestCase = {
    testCaseId: string;
    scenarioTitle: string;
    testType: 'E2E' | 'Negative' | 'Edge' | 'Security' | 'Boundary' | 'Resilience' | 'Persona';
    priority: 'P1' | 'P2' | 'P3';
    preconditions: string;
    testData: string;
    testSteps: string;
    expectedResult: string;
    
    // Traceability fields
    linkedRequirementId?: string;
    linkedAcceptanceCriteriaIds?: string[];
    projectKey?: string;
    defectId?: string;
    executionStatus?: 'Passed' | 'Failed' | 'Blocked' | 'Untested';
};

export type SuiteKey = 'smoke' | 'sanity' | 'regression';

export type AutomationTargetSource = 'jira_story' | 'generated_script' | 'manual_session';

export type AutomationTarget = {
    sessionId: string;
    jiraStoryId?: string;
    sessionTitle?: string;
    targetUrl?: string;
    targetUrlSource?: AutomationTargetSource;
    generatedTestCaseIds?: string[];
    generatedScriptPath?: string;
    latestRunId?: string;
};

export type AutomationRunStatus = 'passed' | 'failed' | 'partial_success' | 'error' | 'blocked';

export type AutomationRunRecord = {
    runId: string;
    suite?: string;
    targetUrl?: string;
    browser?: string;
    mode?: 'Headed' | 'Headless';
    status: AutomationRunStatus;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
    passed?: number;
    failed?: number;
    logs?: string[];
    playwrightReportUrl?: string | null;
    allureReportUrl?: string | null;
    healingReportUrl?: string | null;
    logUrl?: string | null;
    healingStatus?: 'Auto-Healed' | 'Partially Healed' | 'Needs Manual Review' | 'Not Healable' | string;
    failedTestsCount?: number;
    autoHealedCount?: number;
    manualReviewCount?: number;
    healedScriptPath?: string;
    errors?: {
        execution?: string;
        playwrightReport?: string;
        allureReport?: string;
        healingReport?: string;
    };
};

export type QualityRiskLevel = 'Low' | 'Medium' | 'High';

export type TraceabilityMatrixRow = {
    acceptanceCriterion: string;
    testCaseIds: string[];
    automationRunIds: string[];
    defectIds: string[];
    memoryRecordIds: string[];
};

export type TestCaseQualityScore = {
    overall: number;
    requirementCoverage: number;
    positiveCoverage: number;
    negativeCoverage: number;
    boundaryCoverage: number;
    duplicateDetection: number;
    clarity: number;
    missingScenarios: number;
};

export type RagasStyleScore = {
    available: boolean;
    unavailableReason?: string;
    contextRelevance?: number;
    contextPrecision?: number;
    contextRecall?: number;
    faithfulness?: number;
    answerRelevance?: number;
    hallucinationRisk: QualityRiskLevel;
};

export type QualityReport = {
    id: string;
    generatedAt: string;
    jiraStoryId?: string;
    requirement: string;
    acceptanceCriteria: string[];
    qualityScore: TestCaseQualityScore;
    ragasScore: RagasStyleScore;
    traceabilityMatrix: TraceabilityMatrixRow[];
    acToTestCaseMapping: TraceabilityMatrixRow[];
    missingCoverage: string[];
    duplicateScenarios: {
        scenario: string;
        testCaseIds: string[];
    }[];
    improvementSuggestions: string[];
    memoryVaultRecordIds: string[];
};

export type SuiteExecution = {
    status: 'idle' | 'running' | 'completed' | 'failed';
    lastRunAt?: string;
    reportUrl?: string;
    playwrightReportUrl?: string;
    allureReportUrl?: string;
    healingReportUrl?: string;
    logUrl?: string;
    runId?: string;
    message?: string;
    durationMs?: number;
    output?: string;
    stderr?: string;
    failedTests?: string[];
    healingStatus?: string;
    healedScriptPath?: string;
    targetUrl?: string;
    browser?: string;
};

export type AutomationExecutionSummary = {
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
    reportUrl?: string;
    playwrightReportUrl?: string;
    allureReportUrl?: string;
    healingReportUrl?: string;
    logUrl?: string;
    runId?: string;
    healingStatus?: string;
    failedTestsCount?: number;
    autoHealedCount?: number;
    manualReviewCount?: number;
    healedScriptPath?: string;
};

export type AiGenerationMeta = {
    model?: string;
    requestedModel?: string;
    activeModel?: string | null;
    provider?: AiProviderId;
    providerUsed?: string;
    fallbackUsed?: boolean;
    message?: string;
    jiraWarning?: string;
    attempts?: {
        model: string;
        status: 'success' | 'failed' | 'skipped';
        reason?: string;
    }[];
    chunkingApplied?: boolean;
    chunkCount?: number;
};

export type PlatformType = 'web' | 'mobile' | 'api' | 'automation';
export type WorkspacePanel = 'testcases' | 'api-testing' | 'automation' | 'defect-studio' | 'jira' | 'memory-vault' | 'traceability';

export type WorkspaceSectionHeader = {
    title: string;
    subtitle: string;
};

export type AiGenerationOptions = {
    model: string;
    provider: AiProviderId;
    platformType: PlatformType;
    customPrompt?: string;
    acceptanceCriteria?: string;
    jiraStoryId?: string;
};

export type ConversationMessageType =
    | 'jira_story'
    | 'generated_test_cases'
    | 'api_test_cases'
    | 'automation_run'
    | 'defect'
    | 'quality_report';

export type ConversationMessage = {
    id: string;
    type: ConversationMessageType;
    title?: string;
    prompt?: string;
    platform?: PlatformType;
    result?: { testCases: TestCase[] } | null;
    qualityReport?: QualityReport;
    error?: string | null;
    warning?: string | null;
    aiMeta?: AiGenerationMeta;
    aiOptions?: AiGenerationOptions;
    automationRun?: AutomationRunRecord;
    defectId?: string;
    memoryRecordId?: string;
    createdAt: string;
    updatedAt: string;
};

export type ConversationSession = {
    id: string;
    title?: string;
    prompt: string;
    platform: PlatformType;
    messages?: ConversationMessage[];
    result: { testCases: TestCase[] } | null;
    qualityReport?: QualityReport;
    error: string | null;
    aiMeta?: AiGenerationMeta;
    aiOptions?: AiGenerationOptions;
    generatedScript?: string;
    scriptFileName?: string;
    automationTarget?: AutomationTarget;
    automation: Record<SuiteKey, SuiteExecution>;
    automationRuns?: AutomationRunRecord[];
    reports?: string[];
    createdAt: string;
    updatedAt: string;
};

export type HistoryItem = ConversationSession;
