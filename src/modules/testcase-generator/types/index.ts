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

export type SuiteExecution = {
    status: 'idle' | 'running' | 'completed' | 'failed';
    lastRunAt?: string;
    reportUrl?: string;
    message?: string;
    durationMs?: number;
    output?: string;
    stderr?: string;
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
export type WorkspacePanel = 'testcases' | 'api-testing' | 'automation' | 'defect-studio' | 'jira';

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
    automation: Record<SuiteKey, SuiteExecution>;
    reports?: string[];
    createdAt: string;
    updatedAt: string;
};

export type HistoryItem = ConversationSession;
