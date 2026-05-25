import { NextResponse } from "next/server";
import { ollamaService } from "@/src/services/ai/ollama.service";

export async function GET() {
    try {
        await ollamaService.health();

        // Get available models
        const models = await ollamaService.listModels();

        // Warm up the best available model in the background
        // so it's ready when the user sends their first prompt
        const warmModel = models.find(m =>
            m.startsWith('mistral') ||
            m.startsWith('phi3') ||
            m.startsWith('qwen3')
        ) || models[0];

        if (warmModel) {
            // Don't await — run in background
            ollamaService.warmUp(warmModel).catch(() => {});
        }

        return NextResponse.json({
            connected: true,
            models,
            activeModel: warmModel || null,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ connected: false, message }, { status: 503 });
    }
}