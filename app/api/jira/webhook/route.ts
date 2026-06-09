import { NextResponse } from 'next/server';

/**
 * Webhook endpoint for Jira automation triggers.
 * Handles events like story updates, label changes, etc.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const event = body.webhookEvent;
        const issue = body.issue;

        console.log(`[JiraWebhook] Received event: ${event} for issue: ${issue?.key}`);

        // Logic to identify project key and trigger automation:
        // 1. Identify project key from issue.key
        // 2. Check for specific labels (e.g., 'UAT_TCs')
        // 3. Trigger background jobs for test case generation

        return NextResponse.json({ success: true, message: 'Webhook received' });
    } catch (error) {
        console.error('[JiraWebhook] Error processing webhook:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
