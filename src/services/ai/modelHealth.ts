import { OllamaService } from "./ollama.service";
import { getModelConfig } from "./modelConfig";

export type ModelHealthResult = {
    ok: boolean;
    message?: string;
};

export async function checkModelHealth(ollama: OllamaService, model: string): Promise<ModelHealthResult> {
    try {
        const models = await ollama.listModels();
        if (!models.includes(model)) {
            return { ok: false, message: `Model "${model}" is not installed locally.` };
        }

        await ollama.generate({
            model,
            prompt: 'Return only JSON: {"ok":true}',
            stream: false,
            format: "json",
            options: { ...getModelConfig(model), num_predict: 24, temperature: 0 },
        });

        return { ok: true };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
}
