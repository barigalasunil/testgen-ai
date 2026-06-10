import { AiProviderError, ProviderGenerateRequest, ProviderGenerateResult } from './types';
import { buildMessages, normalizeUnknownError, readOpenAiCompatibleContent } from './shared';

const PROVIDER = 'groq' as const;

export async function generateWithGroq(request: ProviderGenerateRequest): Promise<ProviderGenerateResult> {
    const apiKey = request.settings?.groqApiKey || process.env.GROQ_API_KEY;
    const model = request.model || request.settings?.groqModel || process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

    if (!apiKey) {
        throw new AiProviderError(PROVIDER, 'MISSING_API_KEY', 'Groq API key is missing');
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
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
