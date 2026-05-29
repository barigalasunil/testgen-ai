export async function generateTestCases(
    prompt: string,
    model: string,
    type: string = "functional",
    platformType: string = "web",
    customPrompt?: string,
    acceptanceCriteria?: string,
    provider: string = "local",
    jiraStoryId?: string
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
        }),
    });
    return await res.json();
}

export async function fetchModels(provider: string = 'local') {
    const res = await fetch(`/api/models?provider=${provider}`);
    return await res.json();
}
