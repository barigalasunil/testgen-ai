export interface OllamaRequest {
    model: string;
    prompt: string;
    stream?: boolean;
    format?: string;
    options?: Record<string, unknown>;
}

export interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
}


// Always use 127.0.0.1 — localhost fails on this Windows setup
const OLLAMA_BASE = 'http://127.0.0.1:11434';

export class OllamaService {
    private baseUrl: string;
    private activeController: AbortController | null = null;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || OLLAMA_BASE;
    }

    async generate(request: OllamaRequest): Promise<OllamaResponse> {
        if (this.activeController) {
            this.activeController.abort();
            this.activeController = null;
        }

        const controller = new AbortController();
        this.activeController = controller;

        // 8 minute timeout for large models cold-starting
        const timeoutId = setTimeout(() => controller.abort(), 8 * 60 * 1000);

        try {
            console.log(`[OLLAMA] Calling ${this.baseUrl} with model: ${request.model}`);

            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...request,
                    stream: request.stream ?? false,
                    format: request.format ?? 'json',
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama Error ${response.status}: ${errorText}`);
            }

            return await response.json() as OllamaResponse;

        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                throw new Error(
                    `Model "${request.model}" timed out loading.\n\n` +
                    `Run this in terminal to pre-load it:\n` +
                    `  ollama run qwen3:1.7b "hi"\n\n` +
                    `Then try again immediately.`
                );
            }
            throw err;
        } finally {
            clearTimeout(timeoutId);
            if (this.activeController === controller) {
                this.activeController = null;
            }
        }
    }

    async listModels(): Promise<string[]> {
        const response = await fetch(`${this.baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        const data = await response.json() as { models: { name: string }[] };
        return data.models.map(m => m.name);
    }

    async health(): Promise<void> {
        const response = await fetch(`${this.baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            throw new Error(`Ollama unavailable: ${response.status}`);
        }
        await response.json();
    }

    async warmUp(model: string): Promise<void> {
        try {
            console.log(`[OLLAMA] Warming up: ${model}`);
            await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt: 'hi',
                    stream: false,
                    options: { num_predict: 1 },
                }),
                signal: AbortSignal.timeout(8 * 60 * 1000),
            });
            console.log(`[OLLAMA] Warmed up: ${model}`);
        } catch {
            console.warn(`[OLLAMA] Warm up failed for ${model}`);
        }
    }

}
export const ollamaService = new OllamaService();
