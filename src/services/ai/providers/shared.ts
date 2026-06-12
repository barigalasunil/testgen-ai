import { AiProviderError, ProviderErrorCode, RuntimeProviderId } from './types';

export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function normalizeStatusCode(status: number): ProviderErrorCode {
    if (status === 401 || status === 403) return 'MISSING_API_KEY';
    if (status === 402) return 'QUOTA_EXCEEDED';
    if (status === 408 || status === 504) return 'TIMEOUT';
    if (status === 413) return 'TOKEN_LIMIT';
    if (status === 429) return 'RATE_LIMIT';
    if (status >= 500) return 'PROVIDER_ERROR';
    return 'PROVIDER_ERROR';
}

export function normalizeUnknownError(provider: RuntimeProviderId, error: unknown): AiProviderError {
    if (error instanceof AiProviderError) return error;
    const message = getErrorMessage(error);
    const lower = message.toLowerCase();

    if (lower.includes('abort') || lower.includes('timeout')) {
        return new AiProviderError(provider, 'MODEL_TIMEOUT', `${provider} (${message})`);
    }
    if (provider === 'ollama' && (lower.includes('offline') || lower.includes('ecunnrefused') || lower.includes('unreachable'))) {
        return new AiProviderError(provider, 'OLLAMA_OFFLINE', 'Ollama is offline or unreachable');
    }
    if (lower.includes('fetch failed')) {
        return new AiProviderError(provider, provider === 'ollama' ? 'OLLAMA_OFFLINE' : 'NETWORK_ERROR', `${provider} network error`);
    }
    if (lower.includes('model') && lower.includes('missing')) {
        return new AiProviderError(provider, 'MISSING_MODEL', message);
    }
    if (lower.includes('rate') || lower.includes('429')) {
        return new AiProviderError(provider, 'RATE_LIMIT', `${provider} rate limited the request`);
    }
    if (lower.includes('quota') || lower.includes('402')) {
        return new AiProviderError(provider, 'QUOTA_EXCEEDED', `${provider} quota exceeded`);
    }
    if (lower.includes('token') || lower.includes('context')) {
        return new AiProviderError(provider, 'TOKEN_LIMIT', `${provider} token limit exceeded`);
    }
    if (lower.includes('fetch failed') || lower.includes('network')) {
        return new AiProviderError(provider, 'NETWORK_ERROR', `${provider} network error`);
    }
    return new AiProviderError(provider, 'PROVIDER_ERROR', message);
}

export async function readOpenAiCompatibleContent(
    provider: RuntimeProviderId,
    response: Response
): Promise<string> {
    if (!response.ok) {
        const errorText = await response.text();
        throw new AiProviderError(
            provider,
            normalizeStatusCode(response.status),
            `${provider} API error ${response.status}: ${errorText.slice(0, 500)}`,
            response.status
        );
    }

    const data = await response.json() as {
        choices?: { message?: { content?: string }; text?: string }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim() || data.choices?.[0]?.text?.trim() || '';
    if (!content) {
        throw new AiProviderError(provider, 'INVALID_RESPONSE', `${provider} returned an empty response`);
    }
    return content;
}

export function buildMessages(prompt: string) {
    return [{ role: 'user', content: prompt }];
}
