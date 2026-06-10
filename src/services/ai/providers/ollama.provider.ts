import { AiProviderError, ProviderGenerateRequest, ProviderGenerateResult } from './types';
import { normalizeUnknownError } from './shared';

const PROVIDER = 'ollama' as const;

export async function generateWithOllama(request: ProviderGenerateRequest): Promise<ProviderGenerateResult> {
    const baseUrl = request.settings?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    const model = request.model || request.settings?.ollamaModel || process.env.OLLAMA_MODEL || 'mistral:7b';

    try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt: request.prompt,
                format: request.responseFormat === 'json' ? 'json' : undefined,
                stream: false,
                options: {
                    num_predict: request.maxTokens ?? 4096,
                    temperature: request.temperature ?? 0.2,
                },
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new AiProviderError(PROVIDER, response.status === 404 ? 'MISSING_MODEL' : 'OLLAMA_OFFLINE', `Ollama API error ${response.status}: ${text.slice(0, 500)}`, response.status);
        }

        const data = await response.json() as { response?: string; output?: string };
        const content = String(data.response || data.output || '').trim();
        if (!content) {
            throw new AiProviderError(PROVIDER, 'INVALID_RESPONSE', 'Ollama returned an empty response');
        }
        return { content, providerUsed: PROVIDER, modelUsed: model };
    } catch (error) {
        throw normalizeUnknownError(PROVIDER, error);
    }
}
