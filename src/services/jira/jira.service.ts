import { getSavedModel, getSavedProvider, loadProviderSettings } from '@/src/services/ai/ai-config.service';

export type JiraCredentials = {
    baseUrl: string;
    email: string;
    apiToken: string;
    projectKey: string;
};

const STORAGE_KEY = 'jira-credentials';

export function saveJiraCredentials(creds: JiraCredentials): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export function loadJiraCredentials(): JiraCredentials | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as JiraCredentials;
    } catch {
        return null;
    }
}

export function clearJiraCredentials(): void {
    localStorage.removeItem(STORAGE_KEY);
}

export async function testConnection(creds: JiraCredentials) {
    const res = await fetch('/api/jira/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            baseUrl: creds.baseUrl,
            email: creds.email,
            apiToken: creds.apiToken,
        }),
    });
    return res.json();
}

// Used by 🐛 Defect button — creates a Bug ticket
export async function createIssue(payload: {
    summary: string;
    description: string;
    issueType: string;  // 'Bug' always from defect modal
    priority: string;
    labels?: string[];
    storyId?: string;
    traceability?: {
        sourceId?: string;
        sourceType?: string;
        testCaseId?: string;
    };
}) {
    const credentials = loadJiraCredentials();
    const res = await fetch('/api/jira/create-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, credentials }),
    });
    return res.json();
}

// Used by AI Defect Reporter tab — generates bug report via Ollama
export async function generateDefect(payload: {
    testCaseTitle: string;
    testCaseSteps: string;
    expectedResult: string;
    actualResult: string;
    model?: string;
}) {
    const res = await fetch('/api/jira/generate-defect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...payload,
            model: payload.model || getSavedModel(),
            provider: getSavedProvider(),
            providerSettings: loadProviderSettings(),
        }),
    });
    return res.json();
}

export type DefectPayload = {
    summary: string;
    description: string;
    actualResult?: string;
    expectedResult?: string;
    issueType?: 'Bug' | 'Defect';
    priority?: string;
    severity?: string;
    storyId?: string;
};

export async function createDefect(payload: DefectPayload) {
    const credentials = loadJiraCredentials();
    const res = await fetch('/api/jira/defect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, credentials }),
    });
    return res.json();
}

export async function reviewDefectWithAi(payload: DefectPayload & {
    quickDescription?: string;
    model?: string;
    provider?: string;
    providerSettings?: unknown;
}) {
    const res = await fetch('/api/jira/review-defect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return res.json();
}

// Used by 📋 Save All to Jira — creates ONE Task with all test cases as a table
export async function saveTestCasesToJira(payload: {
    testCases: unknown[];
    storyId?: string;
    prompt?: string;
}) {
    const credentials = loadJiraCredentials();
    const res = await fetch('/api/jira/save-test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, credentials }),
    });
    return res.json();
}

export async function fetchJiraStory(storyId: string) {
    if (typeof window === 'undefined') {
        const { fetchJiraStoryDirect } = await import('@/app/api/jira/get-story/route');
        return fetchJiraStoryDirect(storyId);
    }

    const credentials = loadJiraCredentials();
    const res = await fetch('/api/jira/get-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId, credentials }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return { success: false, error: 'Jira story lookup returned a non-JSON response.' };
    }
    const data = await res.json();
    if (data?.success) {
        const { memoryIdForJiraStory, upsertMemoryVaultRecord, projectKeyFromText } = await import('@/src/services/memory-vault/memory-vault.service');
        const { upsertStoryTraceability } = await import('@/src/services/traceability/traceability.service');
        const jiraId = data.key || data.storyId || storyId;
        const projectKey = projectKeyFromText(jiraId);
        upsertMemoryVaultRecord({
            id: memoryIdForJiraStory(jiraId) || `jira-story-${storyId}`,
            projectKey,
            sourceType: 'jira_story',
            title: jiraId,
            content: [
                `Jira Story: ${jiraId}`,
                data.summary ? `Summary: ${data.summary}` : '',
                data.description ? `Description:\n${data.description}` : '',
                data.acceptanceCriteria ? `Acceptance Criteria:\n${data.acceptanceCriteria}` : '',
            ].filter(Boolean).join('\n\n'),
            metadata: {
                projectKey,
                jiraId,
                summary: data.summary || '',
                description: data.description || '',
                acceptanceCriteria: data.acceptanceCriteria || '',
                originalJiraUrl: data.issueUrl || data.url || '',
                key: jiraId,
                url: data.issueUrl || data.url,
                status: data.status,
            },
        });
        upsertStoryTraceability({
            storyId: jiraId,
            projectKey,
            summary: data.summary || '',
            description: data.description || '',
            acceptanceCriteria: data.acceptanceCriteria || '',
        });
    }
    return data;
}
