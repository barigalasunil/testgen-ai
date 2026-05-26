import { NextResponse } from 'next/server';

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
            `${normalizedUrl.replace(/\/$/, '')}/rest/api/3/issue/${storyId}?fields=summary,description,acceptance-criteria,comment,issuetype,priority,status`,
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: 'application/json',
                },
            }
        );

        if (!res.ok) {
            const text = await res.text();
            return NextResponse.json(
                { success: false, error: `Jira issue not found: ${res.status}. Check the Story ID.` },
                { status: 404 }
            );
        }

        const data = await res.json();
        const fields = data.fields || {};

        // Extract plain text from ADF description
        function extractText(node: any): string {
            if (!node) return '';
            if (node.type === 'text') return node.text || '';
            if (node.content) return node.content.map(extractText).join(' ');
            return '';
        }

        const description = extractText(fields.description);
        const summary = fields.summary || '';
        const issueType = fields.issuetype?.name || 'Story';
        const projectKey = storyId.split('-')[0];

        // 🔗 PERSIST FOR TRACEABILITY + RAG
        try {
            const { IngestionService } = await import('@/src/services/rag/ingestionService');
            await IngestionService.ingestRequirement({
                jiraStoryId: storyId,
                title: summary,
                description: description,
                acceptanceCriteria: description.slice(0, 500), // Fallback if AC not field
                projectKey: projectKey,
            });
        } catch (ingestError) {
            console.error('[JIRA-FETCH] Ingestion failed:', ingestError);
            // Don't fail the request, just log it
        }

        return NextResponse.json({
            success: true,
            storyId,
            summary,
            description,
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