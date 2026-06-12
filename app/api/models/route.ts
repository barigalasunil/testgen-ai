import { NextResponse } from "next/server";
import { splitModelsByType } from "@/src/services/ai/providers/ollama-utils";

type OllamaTagsResponse = {
    models?: { name: string }[];
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider') || 'auto';
    const ollamaBaseUrl = searchParams.get('ollamaBaseUrl') || 'http://127.0.0.1:11434';

    if (provider === 'ollama') {
        try {
            const res = await fetch(`${ollamaBaseUrl.replace(/\/$/, '')}/api/tags`, {
                signal: AbortSignal.timeout(3000),
            });
            if (!res.ok) {
                return NextResponse.json({
                    success: false,
                    provider: 'ollama',
                    online: false,
                    models: [],
                    chatModels: [],
                    embeddingModels: [],
                    error: 'Ollama Local Offline',
                });
            }
            const data = await res.json() as OllamaTagsResponse;
            const allModels = data.models?.map((m: any) => m.name) || [];
            const { chatModels, embeddingModels } = splitModelsByType(allModels);
            return NextResponse.json({
                success: true,
                provider: 'ollama',
                online: true,
                models: allModels,
                chatModels,
                embeddingModels,
            });
        } catch {
            return NextResponse.json({
                success: false,
                provider: 'ollama',
                online: false,
                models: [],
                chatModels: [],
                embeddingModels: [],
                error: 'Ollama Local Offline',
            });
        }
    }

    // For Cloud Providers and Auto mode
    return NextResponse.json({
        models: ['auto'],
        status: 'Cloud providers managed via configuration',
    });
}
