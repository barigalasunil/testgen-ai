import { OllamaRequest, OllamaResponse, OllamaService } from "./ollama.service";
import { resolveAutoModelOrder, resolveManualModel } from "./fallbackStrategy";
import { checkModelHealth } from "./modelHealth";
import { getModelConfig, isAutoModel } from "./modelConfig";

export type ModelAttempt = {
    model: string;
    status: "success" | "failed" | "skipped";
    reason?: string;
};

export type ManagedGenerationResult = {
    response: OllamaResponse;
    model: string;
    mode: "auto" | "manual";
    attempts: ModelAttempt[];
    fallbackUsed: boolean;
    message: string;
};

export class ModelManagerError extends Error {
    constructor(
        message: string,
        public attempts: ModelAttempt[],
        public mode: "auto" | "manual"
    ) {
        super(message);
        this.name = "ModelManagerError";
    }
}

function toFriendlyModelError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    if (lower.includes("timed out") || lower.includes("abort")) return "Model timed out before completing.";
    if (lower.includes("fetch failed") || lower.includes("econnrefused")) return "Ollama service became unavailable during generation.";
    if (lower.includes("not found") || lower.includes("not installed")) return "Model is not available locally.";
    if (lower.includes("500") || lower.includes("crash")) return "Local model runner failed while generating.";

    return message;
}

export class ModelManager {
    constructor(private ollama: OllamaService = new OllamaService()) {}

    async generate(request: Omit<OllamaRequest, "model" | "options"> & { model?: string }): Promise<ManagedGenerationResult> {
        const mode = isAutoModel(request.model) ? "auto" : "manual";
        let installedModels: string[];
        try {
            installedModels = await this.ollama.listModels();
        } catch (error) {
            throw new ModelManagerError(
                `Ollama service unavailable. ${toFriendlyModelError(error)}\nRetry generation to continue.`,
                [],
                mode
            );
        }
        const candidates = mode === "auto"
            ? resolveAutoModelOrder(installedModels)
            : [resolveManualModel(request.model || "", installedModels)];

        if (candidates.length === 0) {
            throw new Error("No local Ollama models are installed. Pull a model and retry generation.");
        }

        const attempts: ModelAttempt[] = [];

        for (const model of candidates) {
            const health = await checkModelHealth(this.ollama, model);
            if (!health.ok) {
                attempts.push({ model, status: "skipped", reason: toFriendlyModelError(health.message) });
                if (mode === "manual") break;
                continue;
            }

            try {
                const response = await this.ollama.generate({
                    ...request,
                    model,
                    format: request.format ?? "json",
                    stream: request.stream ?? false,
                    options: getModelConfig(model),
                });

                attempts.push({ model, status: "success" });
                const failedBeforeSuccess = attempts.some((attempt) => attempt.status !== "success");

                return {
                    response,
                    model,
                    mode,
                    attempts,
                    fallbackUsed: mode === "auto" && failedBeforeSuccess,
                    message: mode === "auto" && failedBeforeSuccess
                        ? `Primary model unavailable. Switched to: ${model}`
                        : `Using: ${model}`,
                };
            } catch (error) {
                attempts.push({ model, status: "failed", reason: toFriendlyModelError(error) });
                if (mode === "manual") break;
            }
        }

        const details = attempts.map((attempt) => `${attempt.model}: ${attempt.reason || attempt.status}`).join("\n");
        throw new ModelManagerError(
            mode === "auto"
                ? `All configured local models failed.\n${details}\nRetry generation to continue.`
                : `Selected model failed.\n${details}\nRetry generation to continue.`,
            attempts,
            mode
        );
    }
}
