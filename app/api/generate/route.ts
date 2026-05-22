import { NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/src/modules/testcase-generator/prompts";

export async function POST(req: Request) {
    try {
        const { prompt, model } = await req.json();

        console.log("PROMPT:", prompt);
        console.log("MODEL:", model);

        const systemPrompt = SYSTEM_PROMPT(prompt);

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