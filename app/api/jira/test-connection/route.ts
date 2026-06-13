import { NextResponse } from 'next/server';

type JiraConnectionRequest = {
  baseUrl?: string;
  email?: string;
  apiToken?: string;
};

function cleanBaseUrl(url: string) {
  return (url.startsWith('http') ? url : `https://${url}`).replace(/\/$/, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as JiraConnectionRequest;
    const baseUrl = body.baseUrl || process.env.JIRA_BASE_URL;
    const email = body.email || process.env.JIRA_EMAIL;
    const apiToken = body.apiToken || process.env.JIRA_API_TOKEN;

    if (!baseUrl || !email || !apiToken) {
      return NextResponse.json(
        { success: false, error: 'Missing credentials. Fill in all fields first.' },
        { status: 400 }
      );
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const res = await fetch(`${cleanBaseUrl(baseUrl)}/rest/api/3/myself`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Auth failed (${res.status}). Check your email and API token.` },
        { status: 401 }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      displayName: data.displayName,
      email: data.emailAddress,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
