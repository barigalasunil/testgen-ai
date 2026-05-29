import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { testCaseTitle, testCaseSteps, expectedResult, actualResult, model } = await request.json();

    const selectedModel = model || 'mistral:7b';

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

    const ollamaRes = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        prompt,
        format: 'json',
        stream: false,
        options: { num_predict: 1000, temperature: 0.2 },
      }),
    });

    if (!ollamaRes.ok) {
      return NextResponse.json(
        { success: false, error: 'Ollama not reachable. Make sure it is running.' },
        { status: 503 }
      );
    }

    const ollamaData = await ollamaRes.json();
    let parsed: any;

    try {
      let raw = String(ollamaData.response ?? ollamaData.output ?? '').trim();
      if (!raw && Array.isArray(ollamaData.outputs)) {
        raw = ollamaData.outputs.map((item: any) => String(item?.text || item?.response || '')).join('\n').trim();
      }
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