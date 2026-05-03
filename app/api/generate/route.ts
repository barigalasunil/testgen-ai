import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { prompt, model } = await req.json();

        console.log("PROMPT:", prompt);
        console.log("MODEL:", model);

        const systemPrompt = `You are an expert software QA engineer. 
Based on the following request, generate a professional, industry-standard list of test cases. 
You MUST return ONLY valid JSON in the exact following format without hallucinating any extra keys:
{
  "testCases": [
    {
      "id": "TC-01",
      "title": "Short title of test case",
      "description": "Description of what is being tested",
      "steps": "Step 1\\nStep 2...",
      "expectedResult": "Expected outcome",
      "priority": "High"
    }
  ]
}

Priority must be one of: High, Medium, Low.
Do not include markdown blocks like \`\`\`json. Return ONLY the raw JSON object.
Request: ${prompt}`;

        const ollamaRes = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: model || "phi3:mini",
                prompt: systemPrompt,
                stream: false,
                format: "json",
            }),
        });

        if (!ollamaRes.ok) {
            const errorText = await ollamaRes.text();
            console.error("OLLAMA ERROR:", ollamaRes.status, errorText);
            return NextResponse.json({
                error: true,
                result: `Ollama Error: ${ollamaRes.status} ${errorText}`,
            });
        }

        const data = await ollamaRes.json();
        console.log("OLLAMA RAW RESPONSE:", data);

        let parsedData = null;
        try {
            parsedData = JSON.parse(data.response);
        } catch (e) {
            console.log("Failed to parse Ollama response:", e);
            // fallback
            return NextResponse.json({ error: true, result: "Response was not structured properly. Try again. Raw: " + data.response });
        }

        return NextResponse.json({
            error: false,
            result: parsedData,
        });

    } catch (error) {
        console.error("API ERROR:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: true,
            result: `API ERROR: ${errorMessage}. Ensure Ollama is running and the model is downloaded.`,
        });
    }
}