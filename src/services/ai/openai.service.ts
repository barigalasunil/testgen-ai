import { getServerLLMConfig } from '@/src/config/server-secrets';

export class OpenAIService {
    private baseUrl: string;
    private apiKey: string;

    constructor(baseUrl?: string, apiKey?: string) {
        const config = getServerLLMConfig();
        this.baseUrl = baseUrl || config.nvidiaBaseUrl;
        this.apiKey = apiKey || config.nvidiaApiKey;

        if (!this.apiKey) {
            throw new Error('NVIDIA OpenAI API key is not configured on the server.');
        }
    }

    async createChatCompletion(options: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        top_p?: number;
        max_tokens?: number;
    }) {
        const { model, messages, temperature = 0.7, top_p = 0.8, max_tokens = 4096 } = options;

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                top_p,
                max_tokens,
                stream: false,
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`NVIDIA OpenAI request failed ${response.status}: ${body}`);
        }

        const data = await response.json();
        return data;
    }
}

export const openAIService = new OpenAIService();
