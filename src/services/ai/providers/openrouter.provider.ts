import { AiProviderError, ProviderGenerateRequest, ProviderGenerateResult } from './types';
import { buildMessages, normalizeUnknownError, readOpenAiCompatibleContent } from './shared';

const PROVIDER = 'openrouter' as const;

export async function generateWithOpenRouter(request: ProviderGenerateRequest): Promise<ProviderGenerateResult> {
    const apiKey = request.settings?.openrouterApiKey || process.env.OPENROUTER_API_KEY;
    const model = request.model || request.settings?.openrouterModel || process.env.OPENROUTER_MODEL || 'openrouter/auto';

    if (!apiKey) {
        throw new AiProviderError(PROVIDER, 'MISSING_API_KEY', 'OpenRouter API key is missing');
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'TCGen-Buddy QA Platform',
            },
            body: JSON.stringify({
                model,
                messages: buildMessages(request.prompt),
                max_tokens: request.maxTokens ?? 4000,
                temperature: request.temperature ?? 0.2,
            }),
            signal: AbortSignal.timeout(45000),
        });
        return { content: await readOpenAiCompatibleContent(PROVIDER, response), providerUsed: PROVIDER, modelUsed: model };
    } catch (error) {
        throw normalizeUnknownError(PROVIDER, error);
    }
}
