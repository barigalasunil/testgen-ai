import { NextResponse } from "next/server";
import { ollamaService } from "@/src/services/ai/ollama.service";
import { promptBuilder, TestType, PlatformType } from "@/src/services/ai/prompt-builder";
import { responseParser } from "@/src/services/ai/response-parser";

export async function POST(req: Request) {
    try {
        const { 
            prompt, 
            model, 
            type = "functional", 
            platformType = "web",
            customPrompt,
            acceptanceCriteria 
        } = await req.json();

        console.log("GENERATION REQUEST:", { prompt, model, type, platformType });

        // 1. Build the modular prompt
        const fullPrompt = promptBuilder.buildPrompt(
            prompt, 
            type as TestType, 
            platformType as PlatformType,
            customPrompt,
            acceptanceCriteria
        );

        // 2. Generate response using Ollama
        const response = await ollamaService.generate({
            model: model || "phi3:mini",
            prompt: fullPrompt,
            format: "json",
            stream: false
        });

        // 3. Parse and validate
        const parsedData = responseParser.parse(response.response);

        return NextResponse.json({
            error: false,
            result: parsedData,
        });

    } catch (error) {
        console.error("API ERROR:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: true,
            result: `API ERROR: ${errorMessage}. Ensure Ollama is running and the model is downloaded.`,
        });
    }
}