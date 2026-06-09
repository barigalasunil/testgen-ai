export type CloudProviderName = 'OpenRouter' | 'Groq';

export type CloudGenerationResult = {
    provider: CloudProviderName;
    model: string;
    content: string;
    fallbackUsed: boolean;
    attempts: {
        provider: CloudProviderName;
        model: string;
        status: 'success' | 'failed' | 'skipped';
        reason?: string;
    }[];
};

function extractErrorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function shouldFallback(error: unknown): boolean {
    const message = extractErrorText(error).toLowerCase();
    return [
        'token',
        'context',
        'quota',
        'rate',
        'limit',
        '429',
        '402',
        '403',
        '500',
        '502',
        '503',
        '504',
        'api error',
        'openrouter error',
    ].some((needle) => message.includes(needle));
}

async function readCloudContent(res: Response, provider: CloudProviderName): Promise<string> {
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${provider} error ${res.status}: ${errText}`);
    }

    const data = await res.json() as {
        choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content?.trim() || '';
    if (!content) {
        throw new Error(`${provider} returned an empty response`);
    }
    return content;
}

export class CloudProviderService {
    async generateWithOpenRouter(prompt: string, modelOverride?: string): Promise<{ content: string; model: string }> {
        const apiKey = process.env.OPENROUTER_API_KEY;
        const model = modelOverride || process.env.OPENROUTER_MODEL || 'openrouter/auto';

        if (!apiKey) {
            throw new Error('OPENROUTER_API_KEY is not configured');
        }

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'TCGen-Buddy QA Platform',
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4000,
                temperature: 0.2,
            }),
            signal: AbortSignal.timeout(60000),
        });

        return { content: await readCloudContent(res, 'OpenRouter'), model };
    }

    async generateWithGroq(prompt: string, modelOverride?: string): Promise<{ content: string; model: string }> {
        const apiKey = process.env.GROQ_API_KEY;
        const model = modelOverride || process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

        if (!apiKey) {
            throw new Error('GROQ_API_KEY is not configured');
        }

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4000,
                temperature: 0.2,
            }),
            signal: AbortSignal.timeout(60000),
        });

        return { content: await readCloudContent(res, 'Groq'), model };
    }

    async generateWithFallback(prompt: string, modelOverride?: string): Promise<CloudGenerationResult> {
        const attempts: CloudGenerationResult['attempts'] = [];

        try {
            const primary = await this.generateWithOpenRouter(prompt, modelOverride);
            attempts.push({ provider: 'OpenRouter', model: primary.model, status: 'success' });
            return {
                provider: 'OpenRouter',
                model: primary.model,
                content: primary.content,
                fallbackUsed: false,
                attempts,
            };
        } catch (openRouterError) {
            const reason = extractErrorText(openRouterError);
            attempts.push({
                provider: 'OpenRouter',
                model: modelOverride || process.env.OPENROUTER_MODEL || 'openrouter/auto',
                status: 'failed',
                reason,
            });

            if (!shouldFallback(openRouterError)) {
                throw new Error(`OpenRouter failed and is not eligible for fallback: ${reason}`);
            }

            try {
                const fallback = await this.generateWithGroq(prompt);
                attempts.push({ provider: 'Groq', model: fallback.model, status: 'success' });
                return {
                    provider: 'Groq',
                    model: fallback.model,
                    content: fallback.content,
                    fallbackUsed: true,
                    attempts,
                };
            } catch (groqError) {
                const groqReason = extractErrorText(groqError);
                attempts.push({
                    provider: 'Groq',
                    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
                    status: 'failed',
                    reason: groqReason,
                });
                throw new Error(`OpenRouter failed: ${reason}. Groq fallback also failed: ${groqReason}`);
            }
        }
    }
}

export const cloudProviderService = new CloudProviderService();
