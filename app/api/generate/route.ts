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

        const systemPrompt = `You are a Senior QA Engineer.
Generate exactly 10 UAT test cases in valid JSON format for the Jira story provided.

Requirements:
- Cover Functional, Negative, Positive, and Edge cases.
- Max 4 concise steps per test case.
- ID Format: ${safeJiraId}_UAT_TC001 to TC010.

Output MUST be a single JSON object:
{
  "testCases": [
    {
      "id": "String",
      "summary": "String",
      "steps": "1. Step\\n2. Step",
      "expectedResult": "String"
    }
  ]
}

Jira Story:
${prompt}`;

        const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
        console.log("[testgen][INFO] Calling Ollama at:", ollamaUrl, "| model:", safeModel, "| prompt length:", systemPrompt.length);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10-min timeout

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
                    options: {
                        num_ctx: 4096, // Reduced from 8192 to save VRAM/Memory
                        num_predict: 2048,
                        temperature: 0.1,
                    }
                }),
                signal: controller.signal,
                cache: "no-store",
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!ollamaRes.ok) {
            console.error("[testgen][ERROR] Ollama returned non-OK status:", ollamaRes.status, "| model:", safeModel);
            const errorMsg = ollamaRes.status === 404 
                ? `Model '${safeModel}' not found in Ollama. Please download it or select a different model.` 
                : `Ollama returned an error (${ollamaRes.status}). Ensure the model is loaded and you have enough VRAM/Memory.`;
            return NextResponse.json({
                error: true,
                result: errorMsg,
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
            console.error("[testgen][ERROR] Request timed out after 10 minutes.");
            return NextResponse.json({
                error: true,
                result: "The request timed out. The model is taking too long for this large prompt. Try a more powerful GPU or wait a bit longer.",
            });
        }
        console.error("[testgen][ERROR] Unexpected failure:", (error as Error).message);
        return NextResponse.json({
            error: true,
            result: `Connection Error: ${(error as Error).message}. Ensure Ollama is running at ${process.env.OLLAMA_URL || "http://127.0.0.1:11434"} and the model is downloaded.`,
        });
    }
}