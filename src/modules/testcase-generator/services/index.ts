import { AiProviderId, ProviderSettings } from "@/src/services/ai/provider-orchestrator";

type ModelOption = {
    id?: unknown;
    name?: unknown;
};

function normalizeModelList(models: unknown): string[] {
    if (!Array.isArray(models)) return [];
    return models
        .map((model) => {
            if (typeof model === 'string') return model;
            if (model && typeof model === 'object') {
                const option = model as ModelOption;
                return typeof option.id === 'string'
                    ? option.id
                    : typeof option.name === 'string'
                        ? option.name
                        : '';
            }
            return '';
        })
        .filter(Boolean);
}

export async function generateTestCases(
    prompt: string,
    model: string,
    type: string = "functional",
    platformType: string = "web",
    customPrompt?: string,
    acceptanceCriteria?: string,
    provider: AiProviderId = "auto",
    jiraStoryId?: string,
    providerSettings?: ProviderSettings,
    memoryContext?: string
) {
    const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            prompt,
            model,
            type,
            platformType,
            customPrompt,
            acceptanceCriteria,
            provider,
            jiraStoryId,
            providerSettings,
            memoryContext,
        }),
    });
    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await res.json() : { error: await res.text() };

    if (!res.ok || payload?.success === false) {
        const message = payload?.error || payload?.message || payload?.result || `Generation failed with HTTP ${res.status}`;
        throw Object.assign(new Error(String(message)), {
            status: res.status,
            payload,
        });
    }

    return payload;
}

export async function fetchModels(provider: AiProviderId = 'auto', ollamaBaseUrl: string = 'http://127.0.0.1:11434') {
    const res = await fetch(`/api/models?provider=${provider}&ollamaBaseUrl=${encodeURIComponent(ollamaBaseUrl)}`);
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
        throw new Error('Unable to load models');
    }

    if (!contentType.includes('application/json')) {
        throw new Error('Unable to load models');
    }

    const payload = await res.json();
    const chatModels = normalizeModelList(payload.chatModels || payload.models);
    const models = normalizeModelList(payload.models);

    return {
        ...payload,
        models,
        chatModels,
    };
}
