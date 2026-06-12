import { AiProviderId, ProviderSettings } from "@/src/services/ai/provider-orchestrator";

export async function generateTestCases(
    prompt: string,
    model: string,
    type: string = "functional",
    platformType: string = "web",
    customPrompt?: string,
    acceptanceCriteria?: string,
    provider: AiProviderId = "auto",
    jiraStoryId?: string,
    providerSettings?: ProviderSettings
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
    return await res.json();
}
