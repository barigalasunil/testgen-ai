export async function generateTestCases(
    prompt: string, 
    model: string, 
    type: string = "functional", 
    platformType: string = "web",
    customPrompt?: string,
    acceptanceCriteria?: string
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
            acceptanceCriteria
        }),
    });
    return await res.json();
}

export async function fetchModels() {
    const res = await fetch("/api/models");
    return await res.json();
}
