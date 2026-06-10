import { NextResponse } from "next/server";

type OllamaTagsResponse = {
    models?: { name: string }[];
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider') || 'auto';

    try {
        if (provider === 'ollama') {
            const res = await fetch('http://127.0.0.1:11434/api/tags', {
                signal: AbortSignal.timeout(5000),
            });
            const data = await res.json() as OllamaTagsResponse;
            return NextResponse.json({ models: data.models?.map((m) => m.name) || [] });
        }

        return NextResponse.json({ 
            models: [
                'auto',
                process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
                process.env.OPENROUTER_MODEL || 'openrouter/auto',
                'openai/gpt-4o-mini',
                process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
                process.env.OPENCODE_MODEL || 'opencode/default',
                process.env.OLLAMA_MODEL || 'mistral:7b',
            ],
            status: 'AUTO: NVIDIA, OpenRouter, Groq, OpenCode, Ollama Local',
        });
    } catch (error) {
        return NextResponse.json({ models: [], error: String(error) }, { status: 503 });
    }
}
