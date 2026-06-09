import { NextResponse } from 'next/server';

function extractAdfText(node: unknown): string {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(extractAdfText).join(' ');
    if (typeof node !== 'object') return '';

    const record = node as { type?: string; text?: string; content?: unknown[] };
    if (record.type === 'text') return record.text || '';
    if (record.type === 'paragraph' || record.type === 'heading') {
        return (record.content || []).map(extractAdfText).join('') + '\n\n';
    }
    if (Array.isArray(record.content)) {
        return record.content.map(extractAdfText).join(' ');
    }
    return '';
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storyId = searchParams.get('storyId');
        const baseUrl = searchParams.get('baseUrl') || process.env.JIRA_BASE_URL;
        const email = searchParams.get('email') || process.env.JIRA_EMAIL;
        const apiToken = searchParams.get('apiToken') || process.env.JIRA_API_TOKEN;

        if (!storyId) {
            return NextResponse.json({ success: false, error: 'Story ID is required' }, { status: 400 });
        }
        if (!baseUrl || !email || !apiToken) {
            return NextResponse.json({ success: false, error: 'Jira credentials not configured' }, { status: 400 });
        }

        const normalizedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
        const res = await fetch(
            `${normalizedUrl.replace(/\/$/, '')}/rest/api/3/issue/${storyId}?fields=summary,description,issuetype,priority,status`,
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: 'application/json',
                },
            }
        );

        if (!res.ok) {
            return NextResponse.json(
                { success: false, error: `Jira issue not found: ${res.status}. Check the Story ID.` },
                { status: 404 }
            );
        }

        const data = await res.json();
        const fields = data.fields || {};
        const description = extractAdfText(fields.description).trim();
        const summary = fields.summary || '';
        const issueType = fields.issuetype?.name || 'Story';

        let acceptanceCriteria = '';
        for (const key of Object.keys(fields)) {
            const val = fields[key];
            if (!val) continue;

            const text = typeof val === 'string' ? val.trim() : extractAdfText(val).trim();
            if (text.length > 50 && (key.toLowerCase().includes('accept') || text.toLowerCase().includes('acceptance'))) {
                acceptanceCriteria = text;
                break;
            }
        }

        if (!acceptanceCriteria) {
            const paragraphs = description.split('\n').filter((p) => p.trim());
            acceptanceCriteria = paragraphs.slice(-3).join('\n').slice(0, 1000);
        }

        return NextResponse.json({
            success: true,
            storyId,
            summary,
            description,
            acceptanceCriteria,
            issueType,
            priority: fields.priority?.name || 'Medium',
            status: fields.status?.name || '',
            issueUrl: `${normalizedUrl.replace(/\/$/, '')}/browse/${storyId}`,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
