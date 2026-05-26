import { NextResponse } from "next/server";
import { ollamaService } from "@/src/services/ai/ollama.service";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider') || 'local';

    try {
        if (provider === 'local') {
            await ollamaService.health();
            const models = await ollamaService.listModels();
            return NextResponse.json({ connected: true, provider: 'local', models });
        } else {
            // Cloud (OpenRouter) health check
            if (!process.env.OPENROUTER_API_KEY) {
                return NextResponse.json({ connected: false, message: 'Cloud API key missing' }, { status: 401 });
            }
            const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
                headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
                signal: AbortSignal.timeout(5000)
            });
            return NextResponse.json({ connected: res.ok, provider: 'cloud' });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ connected: false, message }, { status: 503 });
    }
}