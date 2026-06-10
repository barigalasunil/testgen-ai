import { NextResponse } from 'next/server';
import { aiProviderOrchestrator, AiProviderId, ProviderSettings } from '@/src/services/ai/provider-orchestrator';

export async function POST(request: Request) {
  try {
    const { testCaseTitle, testCaseSteps, expectedResult, actualResult, model, provider = 'auto', providerSettings } = await request.json() as {
      testCaseTitle: string;
      testCaseSteps: string;
      expectedResult: string;
      actualResult?: string;
      model?: string;
      provider?: AiProviderId;
      providerSettings?: ProviderSettings;
    };

    const selectedModel = model || 'auto';

    const prompt = `You are a QA engineer writing a professional Jira bug report.
Return ONLY valid JSON, no markdown, no explanation.

Test Case: ${testCaseTitle}
Steps to Reproduce:
${testCaseSteps}
Expected Result: ${expectedResult}
Actual Result: ${actualResult || 'Not specified'}

Return this exact JSON structure:
{
  "summary": "One line bug summary under 100 chars",
  "description": "## Steps to Reproduce\\n1. ...\\n\\n## Expected Result\\n...\\n\\n## Actual Result\\n...\\n\\n## Environment\\nSauceDemo web app, Chrome browser",
  "priority": "High",
  "labels": ["regression", "saucedemo"]
}

Priority must be High, Medium, or Low based on severity.`;

    const aiResult = await aiProviderOrchestrator.generate(provider, {
      prompt,
      model: selectedModel,
      settings: providerSettings,
      responseFormat: 'json',
      maxTokens: 1000,
      temperature: 0.2,
    });
    let parsed: {
      summary?: string;
      description?: string;
      priority?: string;
      labels?: unknown;
    };

    try {
      let raw = aiResult.content.trim();
      raw = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { success: false, error: 'AI returned invalid JSON. Try again.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      summary: String(parsed.summary || testCaseTitle),
      description: String(parsed.description || ''),
      priority: String(parsed.priority || 'Medium'),
      labels: Array.isArray(parsed.labels) ? parsed.labels : [],
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
