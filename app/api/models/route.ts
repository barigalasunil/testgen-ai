import { NextResponse } from "next/server";

export async function GET() {
    try {
        const res = await fetch('http://127.0.0.1:11434/api/tags', {
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
            console.error('[MODELS] Ollama returned:', res.status);
            return NextResponse.json({ 
                models: [],
                error: `Ollama returned status ${res.status}` 
            }, { status: 503 });
        }

        const data = await res.json() as { models: { name: string }[] };
        const models = data.models?.map(m => m.name) || [];
        console.log('[MODELS] Available:', models);

        return NextResponse.json({ models, error: null });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[MODELS] Error:', msg);
        return NextResponse.json({ 
            models: [],
            error: `Cannot reach Ollama: ${msg}` 
        }, { status: 503 });
    }
}