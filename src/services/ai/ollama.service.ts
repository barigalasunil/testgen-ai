export interface OllamaRequest {
    model: string;
    prompt: string;
    stream?: boolean;
    format?: string;
    options?: Record<string, unknown>;
    timeoutMs?: number;
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

export class OllamaService {
    private baseUrl: string;
    private activeController: AbortController | null = null;

    constructor(baseUrl: string = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434") {
        this.baseUrl = baseUrl;
    }

    async generate(request: OllamaRequest): Promise<OllamaResponse> {
        // Cancel any previous hanging request before starting new one.
        if (this.activeController) {
            this.activeController.abort();
            this.activeController = null;
        }

        const controller = new AbortController();
        this.activeController = controller;

        // Local models can need several minutes to produce full test-case JSON.
        const timeoutMs = request.timeoutMs ?? 10 * 60 * 1000;
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeoutMs);

        try {
            const ollamaRequest = { ...request };
            delete ollamaRequest.timeoutMs;
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...ollamaRequest,
                    stream: request.stream ?? false,
                    format: request.format ?? "json",
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama Error ${response.status}: ${errorText}`);
            }

            return await response.json() as OllamaResponse;
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error(`Ollama generation timed out after ${Math.round(timeoutMs / 1000)} seconds. Try a smaller model, reduce the prompt, or increase the timeout.`);
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
        if (!response.ok) throw new Error(`Failed to fetch models: ${response.statusText}`);
        const data = await response.json() as { models: { name: string }[] };
        return data.models.map((m) => m.name);
    }

    async health(): Promise<void> {
        const response = await fetch(`${this.baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama unavailable: ${response.status} ${errorText}`);
        }
        await response.json();
    }
}

export const ollamaService = new OllamaService();
