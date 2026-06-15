import { NextResponse } from 'next/server';

type JiraCredentials = {
    baseUrl?: string;
    email?: string;
    apiToken?: string;
    projectKey?: string;
};

type JiraConfig = {
    baseUrl: string;
    email: string;
    apiToken: string;
    projectKey: string;
};

type JiraTestCase = {
    testCaseId: string;
    scenarioTitle: string;
    testType: string;
    priority: string;
    preconditions?: string;
    testData?: string;
    testSteps?: string;
    expectedResult?: string;
};

const preferredIssueTypes = ['Task', 'Story', 'Test', 'Bug'];

function cleanBaseUrl(url: string) {
    return (url.startsWith('http') ? url : `https://${url}`).replace(/\/$/, '');
}

function normalizeProjectKey(projectKey: string) {
    return projectKey.trim().toUpperCase();
}

function validateProjectKey(projectKey: string) {
    return /^[A-Z][A-Z0-9_]*$/.test(projectKey);
}

function getJiraConfig(credentials?: JiraCredentials): JiraConfig | { error: string } {
    const baseUrl = (process.env.JIRA_BASE_URL || credentials?.baseUrl || '').trim();
    const email = (process.env.JIRA_EMAIL || credentials?.email || '').trim();
    const apiToken = (process.env.JIRA_API_TOKEN || credentials?.apiToken || '').trim();
    const projectKeyRaw = (process.env.JIRA_PROJECT_KEY || credentials?.projectKey || '').trim();

    if (!baseUrl || !email || !apiToken) {
        return { error: 'Jira settings missing. Open Settings and save Jira Base URL, Email, and API Token, or configure them in .env.local.' };
    }
    if (!projectKeyRaw) {
        return { error: 'Jira project key missing. Open Settings and save Jira Project Key, or configure JIRA_PROJECT_KEY in .env.local.' };
    }

    const projectKey = normalizeProjectKey(projectKeyRaw);
    if (!validateProjectKey(projectKey)) {
        return { error: 'Jira project key is invalid. Use the project key shown in Jira, for example TCGB.' };
    }

    return { baseUrl, email, apiToken, projectKey };
}

// ── Extract exact Jira error message ──────────────────────────────────────
function extractJiraError(responseText: string, status: number): string {
    try {
        const errorJson = JSON.parse(responseText) as { errorMessages?: string[]; errors?: Record<string, string> };
        const messages = Array.isArray(errorJson.errorMessages) ? errorJson.errorMessages : [];
        const errors = Object.entries(errorJson.errors || {}).map(([field, value]) => `${field}: ${String(value)}`);
        const combined = [...messages, ...errors].filter(Boolean).join(', ');
        if (combined) return `Jira API error (${status}): ${combined}`;
    } catch {}
    return `Jira API error (HTTP ${status}): ${responseText.slice(0, 500)}`;
}

async function runPreflight({
    normalizedUrl,
    auth,
    projectKey,
}: {
    normalizedUrl: string;
    auth: string;
    projectKey: string;
}): Promise<{ issueType: string; warning?: string } | { error: string; status: number }> {
    // ── Step 1: Validate project exists ──────────────────────────────
    const projectRes = await fetch(`${normalizedUrl}/rest/api/3/project/${encodeURIComponent(projectKey)}`, {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    const projectText = await projectRes.text();
    if (!projectRes.ok) {
        return { error: `Project validation failed: ${extractJiraError(projectText, projectRes.status)}`, status: projectRes.status };
    }

    // ── Step 2: Verify issue type exists (check preferred types) ────
    const issuetypeRes = await fetch(`${normalizedUrl}/rest/api/3/issuetype`, {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    const issuetypeText = await issuetypeRes.text();
    if (!issuetypeRes.ok) {
        return { error: `Issue type lookup failed: ${extractJiraError(issuetypeText, issuetypeRes.status)}`, status: issuetypeRes.status };
    }

    let issuetypeData: { name?: string }[];
    try { issuetypeData = JSON.parse(issuetypeText); } catch {
        return { error: 'Issue type endpoint returned an invalid response.', status: 502 };
    }

    // ── Step 3: Verify create permission via createmeta ──────────────
    const createmetaUrl = `${normalizedUrl}/rest/api/3/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&expand=projects.issuetypes`;
    const cmRes = await fetch(createmetaUrl, {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    const cmText = await cmRes.text();

    if (!cmRes.ok) {
        return { error: `Permission check failed: ${extractJiraError(cmText, cmRes.status)}`, status: cmRes.status };
    }

    let cmData: { projects?: { key?: string; issuetypes?: { name?: string; subtask?: boolean }[] }[] };
    try { cmData = JSON.parse(cmText); } catch {
        return { error: 'Permission check returned an invalid response.', status: 502 };
    }

    const projectMeta = cmData.projects?.find(p => p.key?.toUpperCase() === projectKey.toUpperCase());
    const creatableTypes = projectMeta?.issuetypes?.filter(t => !t.subtask).map(t => t.name).filter(Boolean) || [];

    if (!projectMeta || creatableTypes.length === 0) {
        return { error: `User does not have permission to create issues in project "${projectKey}".`, status: 403 };
    }

    const issueType = preferredIssueTypes.find(type =>
        creatableTypes.some(t => t?.toLowerCase() === type.toLowerCase())
    ) || creatableTypes[0];
    if (!issueType) {
        return { error: `No creatable issue type found for project "${projectKey}".`, status: 400 };
    }

    const globalTypeExists = issuetypeData.some(t => t.name?.toLowerCase() === issueType.toLowerCase());
    if (!globalTypeExists) {
        return {
            error: `Selected issue type "${issueType}" does not exist in this Jira instance. Available types: ${issuetypeData.map(t => t.name || '?').join(', ')}`,
            status: 400,
        };
    }

    return {
        issueType,
        warning: issueType === 'Task' ? undefined : `Task issue type is not creatable in ${projectKey}. Created as ${issueType}.`,
    };
}

function smartTitle(testCases: JiraTestCase[], storyId?: string, prompt?: string): string {
    const count = testCases.length;
    if (storyId?.trim()) {
        const projectKey = storyId.trim().split('-')[0] || 'UAT';
        return `${projectKey} | ${storyId.trim()} | Test Cases (${count})`;
    }
    if (prompt?.trim()) {
        const words = prompt.trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((word) => word.length > 2 && !['test', 'testing', 'generate', 'for', 'the', 'and', 'with'].includes(word))
            .slice(0, 4)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
        return `${words.join(' ')} - Test Cases (${count})`;
    }
    return `Test Cases (${count}) - ${new Date().toISOString().slice(0, 10)}`;
}

function buildADFTable(testCases: JiraTestCase[]) {
    return {
        type: 'doc',
        version: 1,
        content: [
            {
                type: 'table',
                attrs: { isNumberColumnEnabled: false, layout: 'default' },
                content: [
                    {
                        type: 'tableRow',
                        content: ['Test Case ID', 'Scenario Title', 'Test Type', 'Priority', 'Preconditions', 'Test Data', 'Test Steps', 'Expected Result'].map((header) => ({
                            type: 'tableHeader',
                            attrs: { background: '#F4F5F7' },
                            content: [{
                                type: 'paragraph',
                                content: [{ type: 'text', text: header, marks: [{ type: 'strong' }] }],
                            }],
                        })),
                    },
                    ...testCases.map((testCase) => ({
                        type: 'tableRow',
                        content: [
                            testCase.testCaseId,
                            testCase.scenarioTitle,
                            testCase.testType,
                            testCase.priority,
                            testCase.preconditions || 'None',
                            testCase.testData || 'N/A',
                            testCase.testSteps || '',
                            testCase.expectedResult || '',
                        ].map((cellText) => ({
                            type: 'tableCell',
                            attrs: {},
                            content: [{
                                type: 'paragraph',
                                content: [{ type: 'text', text: String(cellText) }],
                            }],
                        })),
                    })),
                ],
            },
        ],
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as {
            testCases?: JiraTestCase[];
            credentials?: JiraCredentials;
            storyId?: string;
            prompt?: string;
        };
        const testCases = body.testCases || [];
        const credentials = body.credentials;
        const storyId = body.storyId;
        const prompt = body.prompt;

        if (!Array.isArray(testCases) || testCases.length === 0) {
            return NextResponse.json({ success: false, error: 'No test cases provided.' }, { status: 400 });
        }

        const config = getJiraConfig(credentials);
        if ('error' in config) {
            return NextResponse.json({ success: false, error: config.error }, { status: 400 });
        }

        const normalizedUrl = cleanBaseUrl(config.baseUrl);
        const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

        // ── Log pre-creation details ─────────────────────────────────────
        console.log('[JIRA TEST CASES] --- Pre-creation audit ---');
        console.log('[JIRA TEST CASES] Base URL:', normalizedUrl);
        console.log('[JIRA TEST CASES] Project Key:', config.projectKey);
        console.log('[JIRA TEST CASES] Parent Story ID:', storyId || '(none)');
        console.log('[JIRA TEST CASES] Auth user email:', config.email);

        const preflight = await runPreflight({
            normalizedUrl,
            auth,
            projectKey: config.projectKey,
        });

        if ('error' in preflight) {
            return NextResponse.json({ success: false, error: preflight.error }, { status: preflight.status });
        }

        console.log('[JIRA TEST CASES] Resolved issue type:', preflight.issueType);

        const summary = smartTitle(testCases, storyId, prompt);
        const payload = {
            fields: {
                project: { key: config.projectKey },
                summary,
                issuetype: { name: preflight.issueType },
                description: buildADFTable(testCases),
                labels: ['qa-generated', 'tcgen-buddy'],
            },
        };

        if (storyId) {
            payload.fields.labels.push(storyId.toLowerCase().replace(/[^a-z0-9]/g, '-'));
        }

        console.log('[JIRA TEST CASES] Creating issue:', preflight.issueType, 'in project:', config.projectKey);

        const res = await fetch(`${normalizedUrl}/rest/api/3/issue`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const responseText = await res.text();
        if (!res.ok) {
            console.warn('[JIRA TEST CASES ERROR]', {
                status: res.status,
                projectKey: config.projectKey,
                issueType: preflight.issueType,
                rawError: responseText,
            });
            return NextResponse.json({ success: false, error: extractJiraError(responseText, res.status) }, { status: res.status });
        }

        const data = JSON.parse(responseText) as { key: string };
        const issueKey = data.key;
        const issueUrl = `${normalizedUrl}/browse/${issueKey}`;

        if (storyId?.trim() && issueKey) {
            try {
                await fetch(`${normalizedUrl}/rest/api/3/issueLink`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${auth}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        type: { name: 'Relates' },
                        inwardIssue: { key: issueKey },
                        outwardIssue: { key: storyId.trim() },
                        comment: {
                            body: {
                                type: 'doc',
                                version: 1,
                                content: [{
                                    type: 'paragraph',
                                    content: [{ type: 'text', text: `TCGen-Buddy: ${issueKey} contains test cases generated for ${storyId.trim()}.` }],
                                }],
                            },
                        },
                    }),
                });
            } catch (linkError) {
                console.warn('[JIRA LINK ERROR]', linkError);
            }
        }

        return NextResponse.json({
            success: true,
            issueKey,
            issueUrl,
            issueType: preflight.issueType,
            warning: preflight.warning,
            total: testCases.length,
            message: `Created ${issueKey} with ${testCases.length} test cases as a table${preflight.warning ? ` (${preflight.warning})` : ''}`,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[JIRA SAVE ERROR]', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
