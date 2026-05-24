import { NextResponse } from 'next/server';

function toADF(text: string) {
  const paragraphs = text
    .split(/\r?\n\r?\n/)
    .map(p => p.replace(/\r?\n/g, ' ').trim())
    .filter(Boolean);

  return {
    type: 'doc',
    version: 1,
    content: paragraphs.length > 0
      ? paragraphs.map(p => ({
          type: 'paragraph',
          content: [{ type: 'text', text: p }],
        }))
      : [{ type: 'paragraph', content: [] }],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { summary, description, issueType, priority, storyId, labels, credentials } = body || {};

    // Use credentials from request body first, fall back to env vars
    const baseUrl = credentials?.baseUrl || process.env.JIRA_BASE_URL;
    const email = credentials?.email || process.env.JIRA_EMAIL;
    const apiToken = credentials?.apiToken || process.env.JIRA_API_TOKEN;
    const projectKey = credentials?.projectKey || process.env.JIRA_PROJECT_KEY || 'TCGB';

    if (!baseUrl || !email || !apiToken || !projectKey) {
      return NextResponse.json(
        { success: false, error: 'Jira credentials not configured. Go to Jira Integration settings and save your credentials.' },
        { status: 400 }
      );
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const adfDescription = toADF(description || 'No description provided');

    if (storyId) {
      adfDescription.content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `Related Story: ${storyId}` }],
      });
    }

    const payload: Record<string, any> = {
      fields: {
        project: { key: projectKey },
        summary: summary || 'No summary',
        issuetype: { name: issueType || 'Bug' },
        description: adfDescription,
      },
    };

    if (priority) payload.fields.priority = { name: priority };
    if (labels?.length) payload.fields.labels = labels;

    console.log('[JIRA] Creating issue in project:', projectKey);
    console.log('[JIRA] Payload:', JSON.stringify(payload, null, 2));

    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/api/3/issue`, {
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
    console.log('[JIRA] Response body:', responseText);

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
    const issueUrl = `${baseUrl.replace(/\/$/, '')}/browse/${issueKey}`;

    return NextResponse.json({ success: true, issueKey, issueUrl });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[JIRA ERROR]', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}