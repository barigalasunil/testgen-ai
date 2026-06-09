import { NextResponse } from "next/server";
import { ollamaService } from "@/src/services/ai/ollama.service";

async function checkOpenRouter() {
    if (!process.env.OPENROUTER_API_KEY) {
        return { connected: false, message: 'OPENROUTER_API_KEY missing' };
    }
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        signal: AbortSignal.timeout(5000),
    });
    return { connected: res.ok, message: res.ok ? 'CLOUD: OpenRouter' : `OpenRouter status ${res.status}` };
}

async function checkGroq() {
    if (!process.env.GROQ_API_KEY) {
        return { connected: false, message: 'GROQ_API_KEY missing' };
    }
    const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        signal: AbortSignal.timeout(5000),
    });
    return { connected: res.ok, message: res.ok ? 'CLOUD FALLBACK: Groq' : `Groq status ${res.status}` };
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider') || 'local';

    try {
        if (provider === 'auto') {
            try {
                await ollamaService.health();
                const models = await ollamaService.listModels();
                return NextResponse.json({ connected: true, provider: 'local', fallback: 'auto', models });
            } catch {
                const openRouter = await checkOpenRouter();
                const groq = openRouter.connected ? { connected: false, message: 'Not needed' } : await checkGroq();
                return NextResponse.json({
                    connected: openRouter.connected || groq.connected,
                    provider: openRouter.connected ? 'cloud' : 'cloud-fallback',
                    fallback: 'auto',
                    message: openRouter.connected ? openRouter.message : groq.message,
                }, { status: openRouter.connected || groq.connected ? 200 : 401 });
            }
        }

        if (provider === 'local') {
            await ollamaService.health();
            const models = await ollamaService.listModels();
            return NextResponse.json({ connected: true, provider: 'local', models });
        }

        const openRouter = await checkOpenRouter();
        const groq = openRouter.connected ? { connected: false, message: 'Configured as fallback' } : await checkGroq();
        return NextResponse.json({
            connected: openRouter.connected || groq.connected,
            provider: openRouter.connected ? 'cloud' : 'cloud-fallback',
            primary: openRouter.message,
            fallback: groq.message,
            message: openRouter.connected ? 'CLOUD: OpenRouter' : groq.message,
        }, { status: openRouter.connected || groq.connected ? 200 : 401 });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ connected: false, message }, { status: 503 });
    }
}
