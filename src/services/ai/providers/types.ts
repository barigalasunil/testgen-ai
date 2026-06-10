export type AiProviderId = 'auto' | 'nvidia' | 'openrouter' | 'groq' | 'opencode' | 'ollama';

export type RuntimeProviderId = Exclude<AiProviderId, 'auto'>;

export type ProviderErrorCode =
    | 'MISSING_API_KEY'
    | 'MISSING_MODEL'
    | 'RATE_LIMIT'
    | 'TOKEN_LIMIT'
    | 'QUOTA_EXCEEDED'
    | 'TIMEOUT'
    | 'INVALID_RESPONSE'
    | 'NETWORK_ERROR'
    | 'PROVIDER_ERROR'
    | 'OLLAMA_OFFLINE';

export type ProviderSettings = {
    nvidiaApiKey?: string;
    nvidiaModel?: string;
    openrouterApiKey?: string;
    openrouterModel?: string;
    groqApiKey?: string;
    groqModel?: string;
    opencodeApiKey?: string;
    opencodeModel?: string;
    ollamaBaseUrl?: string;
    ollamaModel?: string;
};

export type ProviderGenerateRequest = {
    prompt: string;
    model?: string;
    settings?: ProviderSettings;
    responseFormat?: 'json' | 'text';
    maxTokens?: number;
    temperature?: number;
};

export type ProviderGenerateResult = {
    content: string;
    providerUsed: RuntimeProviderId;
    modelUsed: string;
};

export class AiProviderError extends Error {
    code: ProviderErrorCode;
    provider: RuntimeProviderId;
    status?: number;

    constructor(provider: RuntimeProviderId, code: ProviderErrorCode, message: string, status?: number) {
        super(message);
        this.name = 'AiProviderError';
        this.provider = provider;
        this.code = code;
        this.status = status;
    }
}
