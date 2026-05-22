import { NextResponse } from "next/server";
import { ollamaService } from "@/src/services/ai/ollama.service";

export async function GET() {
    try {
        const models = await ollamaService.listModels();
        return NextResponse.json({ models });
    } catch (error) {
        console.error("MODELS API ERROR:", error);
        return NextResponse.json({ models: [] }, { status: 500 });
    }
}