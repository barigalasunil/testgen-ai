import { NextResponse } from 'next/server';

function toADF(text: string, isCode?: boolean) {
    if (isCode) {
        return {
            type: 'doc',
            version: 1,
            content: [
                {
                    type: 'codeBlock',
                    attrs: { language: 'java' },
                    content: [{ type: 'text', text: text.slice(0, 30000) }],
                },
            ],
        };
    }
    const paragraphs = text.split(/\r?\n\r?\n/).map(p => p.replace(/\r?\n/g, ' ').trim()).filter(Boolean);
    return {
        type: 'doc',
        version: 1,
        content: paragraphs.length > 0
            ? paragraphs.map(p => ({ type: 'paragraph', content: [{ type: 'text', text: p }] }))
            : [{ type: 'paragraph', content: [] }],
    };
}

export async function POST(request: Request) {
    try {
        const {
            summary,
            description,
            issueType,
            priority,
            storyId,
            labels,
            credentials,
            traceability,
        } = await request.json();

        const baseUrl = credentials?.baseUrl || process.env.JIRA_BASE_URL;
        const email = credentials?.email || process.env.JIRA_EMAIL;
        const apiToken = credentials?.apiToken || process.env.JIRA_API_TOKEN;
        const projectKey = credentials?.projectKey || process.env.JIRA_PROJECT_KEY || 'TCGB';

        if (!baseUrl || !email || !apiToken || !projectKey) {
            return NextResponse.json(
                { success: false, error: 'Jira credentials not configured. Open Jira settings and save your credentials.' },
                { status: 400 }
            );
        }

        const normalizedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
        
        const isCodeContent = description?.trim().startsWith('import ') ||
            description?.trim().startsWith('package ') ||
            description?.trim().startsWith('//') ||
            description?.trim().startsWith('TC-0');
        const adfDescription = toADF(description || 'No description provided', isCodeContent);

        let finalSummary = summary || 'No summary';
        if (storyId && !finalSummary.startsWith('[')) {
            finalSummary = `[${storyId}] ${finalSummary}`;
        }

        if (storyId) {
            (adfDescription.content as any[]).push({
                type: 'paragraph',
                content: [{ type: 'text', text: `Related Story: ${storyId}` }],
            });
        }

        // issueType from modal will be 'Bug' for defects, 'Task' for others
        const payload: Record<string, any> = {
            fields: {
                project: { key: projectKey },
                summary: finalSummary,
                issuetype: { name: issueType || 'Bug' },
                description: adfDescription,
                labels: Array.isArray(labels) ? labels : ['tcgen-buddy', 'qa-defect'],
            },
        };

        if (traceability?.sourceId) {
            payload.fields.description.content.push({
                type: 'paragraph',
                content: [{ type: 'text', text: `Traceability: Source=${traceability.sourceId}${traceability.testCaseId ? ', TestCase=' + traceability.testCaseId : ''}` }],
            });
            if (!payload.fields.labels.includes(traceability.sourceId.toLowerCase().replace(/[^a-z0-9]/g, '-'))) {
                payload.fields.labels.push(traceability.sourceId.toLowerCase().replace(/[^a-z0-9]/g, '-'));
            }
        }

        if (priority) payload.fields.priority = { name: priority };

        console.log('[JIRA] Creating issue:', issueType, 'in project:', projectKey);

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
        console.log('[JIRA] Response status:', res.status);

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

        // 🔗 CREATE FORMAL JIRA ISSUE LINK
        if (storyId && issueKey) {
            try {
                await fetch(`${normalizedUrl.replace(/\/$/, '')}/rest/api/3/issueLink`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${auth}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: { name: 'Relates' },
                        inwardIssue: { key: issueKey },
                        outwardIssue: { key: storyId },
                    }),
                });
                console.log('[JIRA] Linked', issueKey, 'to parent', storyId);
            } catch (linkErr) {
                console.warn('[JIRA] Could not create issue link:', linkErr);
            }
        }

        // 🗄️ PERSIST IN MYSQL FOR TRACKING
        try {
            const { MySqlService } = await import('@/src/services/db/mysql.service');
            await MySqlService.insert('defects', {
                jira_defect_id: issueKey,
                linked_test_case_id: traceability?.testCaseId || null,
                linked_requirement_id: storyId || null,
                status: 'Open',
                project_key: projectKey,
                title: finalSummary,
                severity: priority,
                metadata: JSON.stringify({ issueUrl })
            });
        } catch (dbError) {
            console.error('[DATABASE ERROR] Failed to log defect:', dbError);
        }

        return NextResponse.json({ success: true, issueKey, issueUrl });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[JIRA ERROR]', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}