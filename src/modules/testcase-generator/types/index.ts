export type TestCase = {
    testCaseId: string;
    title: string;
    testType: string;
    priority: "High" | "Medium" | "Low";
    preconditions: string;
    testData: string;
    steps: string;
    expectedResult: string;
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
    fallbackUsed?: boolean;
    message?: string;
    attempts?: {
        model: string;
        status: 'success' | 'failed' | 'skipped';
        reason?: string;
    }[];
};

export type AiGenerationOptions = {
    model: string;
    platformType: 'web' | 'mobile' | 'api';
    customPrompt?: string;
    acceptanceCriteria?: string;
    jiraStoryId?: string;
};

export type ConversationSession = {
    id: string;
    title?: string;
    prompt: string;
    platform: 'web' | 'mobile' | 'api';
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
