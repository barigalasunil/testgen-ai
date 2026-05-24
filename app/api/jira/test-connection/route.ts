import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Read credentials from query params (passed by frontend)
    const { searchParams } = new URL(request.url);
    const baseUrl = searchParams.get('baseUrl') || process.env.JIRA_BASE_URL;
    const email = searchParams.get('email') || process.env.JIRA_EMAIL;
    const apiToken = searchParams.get('apiToken') || process.env.JIRA_API_TOKEN;

    if (!baseUrl || !email || !apiToken) {
      return NextResponse.json(
        { success: false, error: 'Missing credentials. Fill in all fields first.' },
        { status: 400 }
      );
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    const normalizedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
    const res = await fetch(`${normalizedUrl.replace(/\/$/, '')}/rest/api/3/myself`, {
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