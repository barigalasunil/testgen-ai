import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const res = await fetch('http://127.0.0.1:11434/api/tags', {
            signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        return NextResponse.json({
            ollamaReachable: true,
            models: data.models.map((m: any) => m.name),
            usedUrl: 'http://127.0.0.1:11434',
        });
    } catch (err) {
        return NextResponse.json({
            ollamaReachable: false,
            error: err instanceof Error ? err.message : String(err),
            usedUrl: 'http://127.0.0.1:11434',
        });
    }
}