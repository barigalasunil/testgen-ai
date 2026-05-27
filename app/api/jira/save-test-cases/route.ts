import { NextResponse } from 'next/server';

function smartTitle(testCases: any[], storyId?: string, prompt?: string): string {
    const count = testCases.length;
    if (storyId?.trim()) {
        // Format: "UAT | TCGB-4 | Test Cases (8)"
        const projectKey = storyId.trim().split('-')[0] || 'UAT';
        return `${projectKey} | ${storyId.trim()} | Test Cases (${count})`;
    }
    if (prompt?.trim()) {
        const words = prompt.trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w: string) => w.length > 2 && !['test', 'testing', 'generate', 'for', 'the', 'and', 'with'].includes(w))
            .slice(0, 4)
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1));
        return `${words.join(' ')} - Test Cases (${count})`;
    }
    return `Test Cases (${count}) - ${new Date().toISOString().slice(0, 10)}`;
}

function buildADFTable(testCases: any[]) {
    return {
        type: 'doc',
        version: 1,
        content: [
            {
                type: 'table',
                attrs: { isNumberColumnEnabled: false, layout: 'default' },
                content: [
                    // Header row
                    {
                        type: 'tableRow',
                        content: ['Test Case ID', 'Scenario Title', 'Test Type', 'Priority', 'Preconditions', 'Test Data', 'Test Steps', 'Expected Result'].map(h => ({
                            type: 'tableHeader',
                            attrs: { background: '#F4F5F7' },
                            content: [{
                                type: 'paragraph',
                                content: [{ type: 'text', text: h, marks: [{ type: 'strong' }] }],
                            }],
                        })),
                    },
                    // Data rows
                    ...testCases.map(tc => ({
                        type: 'tableRow',
                        content: [
                            tc.testCaseId,
                            tc.scenarioTitle,
                            tc.testType,
                            tc.priority,
                            tc.preconditions || 'None',
                            tc.testData || 'N/A',
                            tc.testSteps || '',
                            tc.expectedResult || '',
                        ].map(cellText => ({
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
        const { testCases, credentials, storyId, prompt } = await request.json();

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

        const adfBody = buildADFTable(testCases);

        const payload: Record<string, any> = {
            fields: {
                project: { key: projectKey },
                summary,
                issuetype: { name: 'Task' },
                description: adfBody,
                labels: ['qa-generated', 'tcgen-buddy'],
            },
        };

        if (storyId) {
            // Add story ID as a label too for filtering
            payload.fields.labels.push(storyId.toLowerCase().replace(/[^a-z0-9]/g, '-'));
        }

        console.log('[JIRA] Creating single task with test case table');

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
        console.log('[JIRA] Status:', res.status);

        if (!res.ok) {
            let errorMsg = `Jira API error ${res.status}`;
            try {
                const errorJson = JSON.parse(responseText);
                const messages = errorJson.errorMessages || [];
                const errors = Object.values(errorJson.errors || {});
                errorMsg = [...messages, ...errors].join(', ') || errorMsg;
            } catch { }
            return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
        }

        const data = JSON.parse(responseText);
        const issueKey = data.key;
        const issueUrl = `${normalizedUrl.replace(/\/$/, '')}/browse/${issueKey}`;

        // 🔗 CREATE FORMAL JIRA ISSUE LINK — link new Task back to parent Story
        if (storyId?.trim() && issueKey) {
            try {
                const linkPayload = {
                    type: { name: 'Relates' },
                    inwardIssue:  { key: issueKey },
                    outwardIssue: { key: storyId.trim() },
                    comment: {
                        body: {
                            type: 'doc', version: 1,
                            content: [{
                                type: 'paragraph',
                                content: [{ type: 'text', text: `TCGen-Buddy: ${issueKey} contains test cases generated for ${storyId.trim()}.` }],
                            }],
                        },
                    },
                };
                const linkRes = await fetch(`${normalizedUrl.replace(/\/$/, '')}/rest/api/3/issueLink`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${auth}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(linkPayload),
                });
                const linkBody = await linkRes.text();
                if (linkRes.ok || linkRes.status === 201) {
                    console.log(`[JIRA LINK] ✓ Linked ${issueKey} → Relates → ${storyId}`);
                } else {
                    console.warn(`[JIRA LINK] ✗ HTTP ${linkRes.status}:`, linkBody);
                }
            } catch (linkError) {
                console.warn('[JIRA LINK ERROR]', linkError);
            }
        }

        // 🗄️ PERSIST TEST CASES IN MYSQL FOR TRACEABILITY
        try {
            const { MySqlService } = await import('@/src/services/db/mysql.service');
            for (const tc of testCases) {
                await MySqlService.insert('test_cases', {
                    test_case_id: tc.testCaseId,
                    title: tc.scenarioTitle,
                    test_type: tc.testType,
                    priority: tc.priority,
                    steps: tc.testSteps,
                    expected_result: tc.expectedResult,
                    project_key: projectKey,
                    linked_requirement_id: storyId || null,
                    jira_task_id: issueKey,
                    execution_status: 'Untested'
                });
            }
        } catch (dbError) {
            console.error('[DATABASE ERROR] Failed to log test cases:', dbError);
        }

        return NextResponse.json({
            success: true,
            issueKey,
            issueUrl,
            total: testCases.length,
            message: `Created ${issueKey} with ${testCases.length} test cases as a table and synced with traceability DB`,
        });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[JIRA SAVE ERROR]', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}