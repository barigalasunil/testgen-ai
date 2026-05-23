export interface OllamaRequest {
    model: string;
    prompt: string;
    stream?: boolean;
    format?: string;
    options?: Record<string, any>;
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

    constructor(baseUrl: string = "http://127.0.0.1:11434") {
        this.baseUrl = baseUrl;
    }

    async generate(request: OllamaRequest): Promise<OllamaResponse> {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...request,
                stream: request.stream ?? false,
                format: request.format ?? "json",
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama Error: ${response.status} ${errorText}`);
        }

        return await response.json();
    }

    async listModels(): Promise<string[]> {
        const response = await fetch(`${this.baseUrl}/api/tags`);
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        const data = await response.json();
        return data.models.map((m: any) => m.name);
    }

    async health(): Promise<void> {
        const response = await fetch(`${this.baseUrl}/api/tags`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama unavailable: ${response.status} ${errorText}`);
        }
        await response.json();
    }
}

export const ollamaService = new OllamaService();
