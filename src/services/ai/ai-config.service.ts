import { AiProviderId, ProviderSettings } from './provider-orchestrator';

const MODEL_KEY = 'tcgen-ai-model';
const PROVIDER_KEY = 'tcgen-ai-provider';
const SETTINGS_KEY = 'tcgen-provider-settings';

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
    nvidiaApiKey: '',
    nvidiaModel: '',
    openrouterApiKey: '',
    openrouterModel: 'openrouter/auto',
    groqApiKey: '',
    groqModel: 'llama-3.1-8b-instant',
    opencodeApiKey: '',
    opencodeModel: '',
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    ollamaModel: '',
};

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

export function getSavedProvider(): AiProviderId {
    if (typeof window === 'undefined') return 'auto';
    try {
        const val = localStorage.getItem(PROVIDER_KEY);
        if (val === 'local') return 'ollama';
        if (val === 'cloud') return 'openrouter';
        return val === 'nvidia' ||
            val === 'openrouter' ||
            val === 'groq' ||
            val === 'opencode' ||
            val === 'ollama' ||
            val === 'auto'
            ? val
            : 'auto';
    } catch {
        return 'auto';
    }
}

export function saveProvider(provider: AiProviderId): void {
    try {
        localStorage.setItem(PROVIDER_KEY, provider);
    } catch { }
}

export function loadProviderSettings(): ProviderSettings {
    if (typeof window === 'undefined') return DEFAULT_PROVIDER_SETTINGS;
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return DEFAULT_PROVIDER_SETTINGS;
        return { ...DEFAULT_PROVIDER_SETTINGS, ...JSON.parse(raw) as ProviderSettings };
    } catch {
        return DEFAULT_PROVIDER_SETTINGS;
    }
}

export function saveProviderSettings(settings: ProviderSettings): void {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { }
}

export function clearProviderSettings(): void {
    try {
        localStorage.removeItem(SETTINGS_KEY);
    } catch { }
}

export function maskSecret(value?: string): string {
    if (!value?.trim()) return '';
    const trimmed = value.trim();
    const prefixLength = Math.min(
        trimmed.startsWith('sk-or-v1-') ? 9 : trimmed.startsWith('gsk_') ? 4 : 6,
        trimmed.length
    );
    return `${trimmed.slice(0, prefixLength)}************`;
}

export function getAiLabel(): string {
    const model = getSavedModel();
    const provider = getSavedProvider();
    if (provider === 'auto') return `AUTO · ${model}`;
    return `${provider.toUpperCase()} · ${model}`;
}
