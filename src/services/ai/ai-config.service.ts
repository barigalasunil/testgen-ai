const MODEL_KEY = 'tcgen-ai-model';
const PROVIDER_KEY = 'tcgen-ai-provider';

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

export function getSavedProvider(): 'local' | 'cloud' | 'auto' {
    if (typeof window === 'undefined') return 'local';
    try {
        const val = localStorage.getItem(PROVIDER_KEY);
        return val === 'cloud' || val === 'auto' ? val : 'local';
    } catch {
        return 'local';
    }
}

export function saveProvider(provider: 'local' | 'cloud' | 'auto'): void {
    try {
        localStorage.setItem(PROVIDER_KEY, provider);
    } catch { }
}

export function getAiLabel(): string {
    const model = getSavedModel();
    const provider = getSavedProvider();
    if (provider === 'cloud') return `CLOUD · ${model}`;
    if (provider === 'auto') return `AUTO · ${model}`;
    return model === 'auto' ? 'Auto (LOCAL)' : `LOCAL · ${model}`;
}
