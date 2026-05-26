const MODEL_KEY = 'tcgen-ai-model';
const PROVIDER_KEY = 'tcgen-ai-provider';
const USE_OPENROUTER_KEY = 'tcgen-use-openrouter';

export function getSavedModel(): string {
    if (typeof window === 'undefined') return 'auto';
    try {
        return localStorage.getItem(MODEL_KEY) || 'auto';
    } catch {
        return 'auto';
    }
}

export function saveModel(model: string): void {
    try {
        localStorage.setItem(MODEL_KEY, model);
    } catch { }
}

export function getSavedProvider(): 'ollama' | 'openrouter' {
    if (typeof window === 'undefined') return 'ollama';
    try {
        const val = localStorage.getItem(USE_OPENROUTER_KEY);
        return val === 'true' ? 'openrouter' : 'ollama';
    } catch {
        return 'ollama';
    }
}

export function saveProvider(provider: 'ollama' | 'openrouter'): void {
    try {
        localStorage.setItem(USE_OPENROUTER_KEY, provider === 'openrouter' ? 'true' : 'false');
    } catch { }
}

export function getAiLabel(): string {
    const model = getSavedModel();
    const provider = getSavedProvider();
    if (provider === 'openrouter') return `OpenRouter · ${model}`;
    return model === 'auto' ? 'Auto (Ollama)' : `Ollama · ${model}`;
}
