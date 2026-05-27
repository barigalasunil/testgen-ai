import { NextResponse } from 'next/server';

// ── ADF Builder ─────────────────────────────────────────────────────────────
function toADF(text: string) {
    const t = text?.trim() || '';

    // Detect code content — wrap in ADF codeBlock for readable Jira rendering
    const isJava = t.startsWith('import ') || t.startsWith('package ') ||
        t.startsWith('public class') || t.startsWith('//') && t.includes('class');
    const isScenario = t.startsWith('TC-0') || /^TC-\d+\s*\|/.test(t.split('\n')[0]);

    if (isJava || isScenario) {
        return {
            type: 'doc',
            version: 1,
            content: [
                {
                    type: 'codeBlock',
                    attrs: { language: isJava ? 'java' : 'plain' },
                    content: [{ type: 'text', text: t.slice(0, 30000) }],
                },
            ],
        };
    }

    // Paragraph-based ADF for plain text
    const paragraphs = t.split(/\r?\n\r?\n/).map(p => p.replace(/\r?\n/g, ' ').trim()).filter(Boolean);
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

        // Issue 4: Prepend [storyId] to summary if not already present
        let finalSummary = summary || 'No summary';
        if (storyId?.trim() && !finalSummary.startsWith('[')) {
            finalSummary = `[${storyId.trim()}] ${finalSummary}`;
        }

        // Issue 7: Detect code and use ADF codeBlock
        const adfDescription = toADF(description || 'No description provided');

        if (storyId) {
            (adfDescription.content as any[]).push({
                type: 'paragraph',
                content: [{ type: 'text', text: `Related Story: ${storyId}` }],
            });
        }

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
            (payload.fields.description.content as any[]).push({
                type: 'paragraph',
                content: [{ type: 'text', text: `Traceability: Source=${traceability.sourceId}${traceability.testCaseId ? ', TestCase=' + traceability.testCaseId : ''}` }],
            });
            const traceLabel = traceability.sourceId.toLowerCase().replace(/[^a-z0-9]/g, '-');
            if (!payload.fields.labels.includes(traceLabel)) {
                payload.fields.labels.push(traceLabel);
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

        // Create formal "Relates" link between new defect and parent story
        if (storyId?.trim() && issueKey) {
            try {
                const linkRes = await fetch(`${normalizedUrl.replace(/\/$/, '')}/rest/api/3/issueLink`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${auth}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        type: { name: 'Relates' },
                        inwardIssue:  { key: issueKey },
                        outwardIssue: { key: storyId.trim() },
                    }),
                });
                const linkBody = await linkRes.text();
                if (linkRes.ok || linkRes.status === 201) {
                    console.log(`[JIRA LINK] ✓ Linked defect ${issueKey} → Relates → ${storyId}`);
                } else {
                    console.warn(`[JIRA LINK] ✗ HTTP ${linkRes.status}:`, linkBody);
                }
            } catch (linkErr) {
                console.warn('[JIRA LINK ERROR]', linkErr);
            }
        }

        // Persist in MySQL for tracking (non-blocking)
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
                metadata: JSON.stringify({ issueUrl }),
            });
        } catch (dbError) {
            console.error('[DATABASE] Failed to log defect:', dbError);
        }

        return NextResponse.json({ success: true, issueKey, issueUrl });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[JIRA ERROR]', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}