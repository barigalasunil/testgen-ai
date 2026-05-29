import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider') || 'local';

    try {
        if (provider === 'auto' || provider === 'local') {
            const res = await fetch('http://127.0.0.1:11434/api/tags', {
                signal: AbortSignal.timeout(5000),
            });
            const data = await res.json();
            return NextResponse.json({ models: data.models?.map((m: any) => m.name) || [] });
        }

        // Cloud (OpenRouter) models
        return NextResponse.json({ 
            models: [
                'anthropic/claude-3.5-sonnet',
                'google/gemini-2.0-flash-001',
                'openai/gpt-4o-mini',
                'gryphe/mythomax-l2-13b',
                'mistralai/mistral-7b-instruct',
                'meta-llama/llama-3.1-8b-instruct'
            ] 
        });
    } catch (error) {
        return NextResponse.json({ models: [], error: String(error) }, { status: 503 });
    }
}