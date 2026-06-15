import { NextResponse } from "next/server";
import { splitModelsByType } from "@/src/services/ai/providers/ollama-utils";
import type { AiProviderId } from "@/src/services/ai/provider-orchestrator";

type OllamaTagsResponse = {
    models?: { name: string }[];
};

type ModelOption = {
    id: string;
    name: string;
};

const SUPPORTED_PROVIDERS: AiProviderId[] = ['ollama', 'nvidia', 'openrouter', 'groq', 'opencode'];

function modelOption(id: string): ModelOption {
    return { id, name: id };
}

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
    return NextResponse.json(body, init);
}

function configuredProviderModel(provider: Exclude<AiProviderId, 'auto' | 'ollama'>): string | undefined {
    if (provider === 'nvidia') return process.env.NVIDIA_MODEL || process.env.NVIDIA_OPENAI_MODEL;
    if (provider === 'openrouter') return process.env.OPENROUTER_MODEL || 'openrouter/auto';
    if (provider === 'groq') return process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    return process.env.OPENCODE_MODEL;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const providerParam = searchParams.get('provider') || 'ollama';
    const provider = (providerParam === 'auto' ? 'ollama' : providerParam) as AiProviderId;
    const ollamaBaseUrl = searchParams.get('ollamaBaseUrl') || 'http://127.0.0.1:11434';

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
        return jsonResponse({
            success: false,
            provider: providerParam,
            models: [],
            chatModels: [],
            embeddingModels: [],
            error: `Unsupported provider: ${providerParam}`,
        }, { status: 400 });
    }

    if (provider === 'ollama') {
        try {
            const res = await fetch(`${ollamaBaseUrl.replace(/\/$/, '')}/api/tags`, {
                signal: AbortSignal.timeout(3000),
            });
            if (!res.ok) {
                return jsonResponse({
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
            const allModels = data.models?.map((model) => model.name) || [];
            const { chatModels, embeddingModels } = splitModelsByType(allModels);
            return jsonResponse({
                success: chatModels.length > 0,
                provider: 'ollama',
                online: chatModels.length > 0,
                models: chatModels.map(modelOption),
                chatModels,
                embeddingModels,
                error: chatModels.length === 0
                    ? (embeddingModels.length > 0
                        ? 'Ollama has no generation models installed'
                        : 'Ollama has no models installed')
                    : undefined,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Ollama Local Offline';
            return jsonResponse({
                success: false,
                provider: 'ollama',
                online: false,
                models: [],
                chatModels: [],
                embeddingModels: [],
                error: message,
            });
        }
    }

    const cloudProvider = provider as Exclude<AiProviderId, 'auto' | 'ollama'>;
    const configuredModel = configuredProviderModel(cloudProvider);

    return jsonResponse({
        success: Boolean(configuredModel),
        provider: cloudProvider,
        online: Boolean(configuredModel),
        models: configuredModel ? [modelOption(configuredModel)] : [],
        chatModels: configuredModel ? [configuredModel] : [],
        embeddingModels: [],
        error: configuredModel ? undefined : `${cloudProvider} model is not configured`,
        status: 'Cloud provider models are managed by configuration',
    });
}
