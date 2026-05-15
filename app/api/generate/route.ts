import { NextResponse } from "next/server";

// Strip markdown code fences if model ignores format:"json"
function extractJSON(raw: string): string {
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) return fenceMatch[1].trim();
    return raw.trim();
}

export async function POST(req: Request) {
    try {
        const { prompt, model, jiraId } = await req.json();

        if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
            return NextResponse.json({ error: true, result: "Prompt is required." }, { status: 400 });
        }

        const safeModel = typeof model === "string" && model.trim() ? model.trim() : "phi3:mini";
        const safeJiraId = typeof jiraId === "string" && jiraId.trim() ? jiraId.trim().toUpperCase() : "JIRA";

        console.log("[testgen][INFO] Generation requested | model:", safeModel, "| jiraId:", safeJiraId);

        const systemPrompt = `You are a QA Engineer.

Generate 10 UAT test cases for the Jira story below.

Cover:
- Functional scenarios
- Negative scenarios
- Positive scenarios
- Edge cases

Rules:
- Keep steps concise
- Maximum 4 steps per test case
- Avoid duplicates
- Professional language
- Number test cases sequentially

Test Case ID Format: ${safeJiraId}_UAT_TC001, ${safeJiraId}_UAT_TC002, ... ${safeJiraId}_UAT_TC010

You MUST return ONLY valid JSON. No markdown, no explanation, no code fences.
Return a single JSON object with a "testCases" array. Each element must have exactly these keys:

{
  "testCases": [
    {
      "id": "${safeJiraId}_UAT_TC001",
      "summary": "Short title of what is being tested",
      "steps": "1. Step one\\n2. Step two\\n3. Step three",
      "expectedResult": "Clear measurable outcome."
    }
  ]
}

Jira Story:
${prompt}`;

        const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
        console.log("[testgen][INFO] Calling Ollama at:", ollamaUrl, "| model:", safeModel);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5-min timeout

        let ollamaRes: Response;
        try {
            ollamaRes = await fetch(`${ollamaUrl}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: safeModel,
                    prompt: systemPrompt,
                    stream: false,
                    format: "json",
                }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!ollamaRes.ok) {
            console.error("[testgen][ERROR] Ollama returned non-OK status:", ollamaRes.status);
            return NextResponse.json({
                error: true,
                result: "The AI model returned an error. Please check the model is loaded and try again.",
                statusCode: ollamaRes.status,
            });
        }

        const data = await ollamaRes.json();
        console.log("[testgen][INFO] Ollama response received | done:", data.done);

        const rawText = extractJSON(data.response || "");
        let parsedData = null;
        try {
            parsedData = JSON.parse(rawText);
        } catch (e) {
            console.error("[testgen][ERROR] Failed to parse model JSON output.");
            return NextResponse.json({
                error: true,
                result: "The model response could not be parsed as valid test case data. Please try again or use a different model.",
            });
        }

        if (!parsedData?.testCases || !Array.isArray(parsedData.testCases)) {
            console.error("[testgen][ERROR] Parsed data missing testCases array.");
            return NextResponse.json({
                error: true,
                result: "The model did not return a valid test case structure. Try rephrasing your prompt.",
            });
        }

        console.log("[testgen][SUCCESS] Generated", parsedData.testCases.length, "test cases | jiraId:", safeJiraId);
        return NextResponse.json({ error: false, result: parsedData, jiraId: safeJiraId });

    } catch (error) {
        if ((error as any)?.name === "AbortError") {
            console.error("[testgen][ERROR] Request timed out after 5 minutes.");
            return NextResponse.json({
                error: true,
                result: "The request timed out. The model is taking too long. Try a lighter model or a shorter prompt.",
            });
        }
        console.error("[testgen][ERROR] Unexpected failure:", (error as Error).message);
        return NextResponse.json({
            error: true,
            result: "An unexpected error occurred. Please ensure Ollama is running and a model is downloaded.",
        });
    }
}