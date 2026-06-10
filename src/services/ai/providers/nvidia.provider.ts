import { AiProviderError, ProviderGenerateRequest, ProviderGenerateResult } from './types';
import { buildMessages, normalizeUnknownError, readOpenAiCompatibleContent } from './shared';

const PROVIDER = 'nvidia' as const;

export async function generateWithNvidia(request: ProviderGenerateRequest): Promise<ProviderGenerateResult> {
    const apiKey = request.settings?.nvidiaApiKey || process.env.NVIDIA_API_KEY || process.env.NVIDIA_OPENAI_API_KEY;
    const model = request.model || request.settings?.nvidiaModel || process.env.NVIDIA_MODEL || process.env.NVIDIA_OPENAI_MODEL;

    if (!apiKey) {
        throw new AiProviderError(PROVIDER, 'MISSING_API_KEY', 'NVIDIA API key is missing');
    }
    if (!model) {
        throw new AiProviderError(PROVIDER, 'MISSING_MODEL', 'NVIDIA model is missing');
    }

    try {
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
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
