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
    errors?: {
        execution?: string;
        playwrightReport?: string;
        allureReport?: string;
        healingReport?: string;
    };
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
};

export type AiGenerationMeta = {
    model?: string;
    requestedModel?: string;
    activeModel?: string | null;
    provider?: AiProviderId;
    providerUsed?: string;
    fallbackUsed?: boolean;
    message?: string;
    attempts?: {
        model: string;
        status: 'success' | 'failed' | 'skipped';
        reason?: string;
    }[];
    chunkingApplied?: boolean;
    chunkCount?: number;
};

export type PlatformType = 'web' | 'mobile' | 'api' | 'automation';
export type WorkspacePanel = 'testcases' | 'api-testing' | 'automation' | 'defect-studio' | 'jira' | 'memory-vault';

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

export type ConversationSession = {
    id: string;
    title?: string;
    prompt: string;
    platform: PlatformType;
    result: { testCases: TestCase[] } | null;
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
