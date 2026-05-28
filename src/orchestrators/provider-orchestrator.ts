export type ProviderType = 'local' | 'cloud';

export type ProviderHealth = 'connecting' | 'connected' | 'error';

export interface ProviderState {
    provider: ProviderType;
    status: ProviderHealth;
    activeModel: string;
    availableModels: string[];
}

export function resolveProvider(provider: ProviderType, health: ProviderHealth): ProviderType {
    if (health === 'connected') return provider;
    return provider === 'local' ? 'cloud' : 'local';
}

export function getProviderLabel(provider: ProviderType): string {
    return provider === 'local' ? 'LOCAL' : 'CLOUD';
}

export function getProviderDescription(provider: ProviderType): string {
    return provider === 'local'
        ? 'Local Ollama inference (free, private)'
        : 'Cloud OpenRouter inference (scalable, multi-model)';
}
