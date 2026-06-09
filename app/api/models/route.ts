import { NextResponse } from "next/server";

type OllamaTagsResponse = {
    models?: { name: string }[];
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider') || 'local';

    try {
        if (provider === 'auto' || provider === 'local') {
            const res = await fetch('http://127.0.0.1:11434/api/tags', {
                signal: AbortSignal.timeout(5000),
            });
            const data = await res.json() as OllamaTagsResponse;
            return NextResponse.json({ models: data.models?.map((m) => m.name) || [] });
        }

        // Cloud models: OpenRouter primary, Groq fallback configured server-side.
        return NextResponse.json({ 
            models: [
                'openrouter/auto',
                'anthropic/claude-3.5-sonnet',
                'google/gemini-2.0-flash-001',
                'openai/gpt-4o-mini',
                'gryphe/mythomax-l2-13b',
                'mistralai/mistral-7b-instruct',
                'meta-llama/llama-3.1-8b-instruct',
                process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
            ],
            status: 'CLOUD: OpenRouter; CLOUD FALLBACK: Groq',
        });
    } catch (error) {
        return NextResponse.json({ models: [], error: String(error) }, { status: 503 });
    }
}
