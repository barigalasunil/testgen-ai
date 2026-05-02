import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { prompt, model } = await req.json();

        console.log("PROMPT:", prompt);
        console.log("MODEL:", model);

        const ollamaRes = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: model || "phi3:mini",
                prompt: prompt,
                stream: false,
            }),
        });

        if (!ollamaRes.ok) {
            const errorText = await ollamaRes.text();
            console.error("OLLAMA ERROR:", ollamaRes.status, errorText);
            return NextResponse.json({
                result: `Ollama Error: ${ollamaRes.status} ${errorText}`,
            });
        }

        const data = await ollamaRes.json();

        console.log("OLLAMA RAW RESPONSE:", data);

        return NextResponse.json({
            result: data.response || "No response from model",
        });

    } catch (error) {
        console.error("API ERROR:", error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            result: `API ERROR: ${errorMessage}. Ensure Ollama is running and the model is downloaded.`,
        });
    }
}