import { NextResponse } from "next/server";

export async function GET() {
    try {
        const res = await fetch('http://127.0.0.1:11434/api/tags', {
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
            console.error('[MODELS] Ollama returned:', res.status);
            return NextResponse.json({ models: [] }, { status: 500 });
        }

        const data = await res.json() as { models: { name: string }[] };
        const models = data.models.map(m => m.name);
        console.log('[MODELS] Returning all models:', models);

        return NextResponse.json({ models });
    } catch (error) {
        console.error('[MODELS] Fetch error:', error);
        return NextResponse.json({ models: [] }, { status: 500 });
    }
}