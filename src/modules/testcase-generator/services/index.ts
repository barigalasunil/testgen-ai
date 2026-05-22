export async function generateTestCases(prompt: string, model: string) {
    const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
    });
    return await res.json();
}

export async function fetchModels() {
    const res = await fetch("/api/models");
    return await res.json();
}
