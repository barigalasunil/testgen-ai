import { AiProviderError, ProviderGenerateRequest, ProviderGenerateResult } from './types';
import { buildMessages, normalizeUnknownError, readOpenAiCompatibleContent } from './shared';

const PROVIDER = 'opencode' as const;

export async function generateWithOpenCode(request: ProviderGenerateRequest): Promise<ProviderGenerateResult> {
    const apiKey = request.settings?.opencodeApiKey || process.env.OPENCODE_API_KEY;
    const model = request.model || request.settings?.opencodeModel || process.env.OPENCODE_MODEL || 'opencode/default';
    const baseUrl = process.env.OPENCODE_BASE_URL || 'https://api.opencode.ai/v1';

    if (!apiKey) {
        throw new AiProviderError(PROVIDER, 'MISSING_API_KEY', 'OpenCode API key is missing');
    }

    try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
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
