import { NextResponse } from 'next/server';

type JiraCredentials = {
    baseUrl?: string;
    email?: string;
    apiToken?: string;
    projectKey?: string;
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

        const baseUrl = credentials?.baseUrl || process.env.JIRA_BASE_URL;
        const email = credentials?.email || process.env.JIRA_EMAIL;
        const apiToken = credentials?.apiToken || process.env.JIRA_API_TOKEN;
        const projectKey = credentials?.projectKey || process.env.JIRA_PROJECT_KEY || 'TCGB';

        if (!baseUrl || !email || !apiToken) {
            return NextResponse.json(
                { success: false, error: 'Jira credentials not configured. Open Jira settings and save credentials first.' },
                { status: 400 }
            );
        }

        const normalizedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
        const summary = smartTitle(testCases, storyId, prompt);
        const payload = {
            fields: {
                project: { key: projectKey },
                summary,
                issuetype: { name: 'Task' },
                description: buildADFTable(testCases),
                labels: ['qa-generated', 'tcgen-buddy'],
            },
        };

        if (storyId) {
            payload.fields.labels.push(storyId.toLowerCase().replace(/[^a-z0-9]/g, '-'));
        }

        const res = await fetch(`${normalizedUrl.replace(/\/$/, '')}/rest/api/3/issue`, {
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
            let errorMsg = `Jira API error ${res.status}`;
            try {
                const errorJson = JSON.parse(responseText) as { errorMessages?: string[]; errors?: Record<string, string> };
                const messages = errorJson.errorMessages || [];
                const errors = Object.values(errorJson.errors || {});
                errorMsg = [...messages, ...errors].join(', ') || errorMsg;
            } catch {
                // Keep the HTTP status message if Jira returns non-JSON.
            }
            return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
        }

        const data = JSON.parse(responseText) as { key: string };
        const issueKey = data.key;
        const issueUrl = `${normalizedUrl.replace(/\/$/, '')}/browse/${issueKey}`;

        if (storyId?.trim() && issueKey) {
            try {
                await fetch(`${normalizedUrl.replace(/\/$/, '')}/rest/api/3/issueLink`, {
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
            total: testCases.length,
            message: `Created ${issueKey} with ${testCases.length} test cases as a table`,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[JIRA SAVE ERROR]', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
