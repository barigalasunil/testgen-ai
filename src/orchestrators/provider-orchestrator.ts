export type ProviderType = 'local' | 'cloud' | 'auto';

export type ProviderHealth = 'connecting' | 'connected' | 'error';

export interface ProviderState {
    provider: ProviderType;
    status: ProviderHealth;
    activeModel: string;
    availableModels: string[];
}

export function resolveProvider(provider: ProviderType, health: ProviderHealth): ProviderType {
    if (provider === 'auto') {
        return health === 'connected' ? 'local' : 'cloud';
    }
    return health === 'connected' ? provider : provider === 'local' ? 'cloud' : 'local';
}

export function getProviderLabel(provider: ProviderType): string {
    if (provider === 'local') return 'LOCAL';
    if (provider === 'cloud') return 'CLOUD';
    return 'AUTO';
}

export function getProviderDescription(provider: ProviderType): string {
    if (provider === 'local') return 'Local Ollama inference (free, private)';
    if (provider === 'cloud') return 'Cloud OpenRouter inference (scalable, multi-model)';
    return 'Auto provider selection with local-first fallback';
}
