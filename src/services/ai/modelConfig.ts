export const AUTO_MODEL = "auto";

export const MODEL_PRIORITY = [
    "llama3:8b",
    "mistral",
    "phi3",
    "gemma",
] as const;

export const MODEL_CONFIG: Record<string, { num_predict: number; temperature: number; top_p: number }> = {
    "llama3:8b": { num_predict: 2400, temperature: 0.25, top_p: 0.92 },
    "mistral:7b": { num_predict: 2400, temperature: 0.3, top_p: 0.95 },
    "phi3:mini": { num_predict: 2400, temperature: 0.2, top_p: 0.9 },
    "gemma4:e4b": { num_predict: 2400, temperature: 0.25, top_p: 0.92 },
};

export const DEFAULT_MODEL_CONFIG = { num_predict: 2000, temperature: 0.3, top_p: 0.95 };

export function getModelConfig(model: string) {
    const key = Object.keys(MODEL_CONFIG).find((k) => model.startsWith(k.split(":")[0]));
    return key ? MODEL_CONFIG[key] : DEFAULT_MODEL_CONFIG;
}

export function isAutoModel(model?: string | null) {
    return !model || model.toLowerCase() === AUTO_MODEL;
}
