import { NextResponse } from "next/server";
import { OllamaService } from "@/src/services/ai/ollama.service";
import { promptBuilder, TestType, PlatformType } from "@/src/services/ai/prompt-builder";
import { responseParser } from "@/src/services/ai/response-parser";

const MODEL_CONFIG: Record<string, { num_predict: number; temperature: number; top_p: number }> = {
    "phi3:mini": { num_predict: 3000, temperature: 0.2, top_p: 0.9 },
    "mistral:7b": { num_predict: 6000, temperature: 0.3, top_p: 0.95 },
    "gemma4:e4b": { num_predict: 6000, temperature: 0.25, top_p: 0.92 },
};

const DEFAULT_CONFIG = { num_predict: 4096, temperature: 0.3, top_p: 0.95 };

function getModelConfig(model: string) {
    const key = Object.keys(MODEL_CONFIG).find(
        (k) => model.startsWith(k.split(":")[0])
    );
    return key ? MODEL_CONFIG[key] : DEFAULT_CONFIG;
}

export async function POST(req: Request) {
    // ── KEY FIX: create a FRESH OllamaService instance per request ──
    // The exported singleton (ollamaService) holds an AbortController reference
    // across requests in Next.js dev mode because the module is cached.
    // A fresh instance per request means no stale controller can cancel it.
    const ollama = new OllamaService();

    try {
        const {
            prompt,
            model,
            type = "functional",
            platformType = "web",
            customPrompt,
            acceptanceCriteria,
        } = await req.json();

        const selectedModel = model || "mistral:7b";
        const modelConfig = getModelConfig(selectedModel);

        console.log("GENERATION REQUEST:", { prompt, selectedModel, type, platformType });
        console.log("MODEL CONFIG:", modelConfig);

        // 1. Build prompt
        const fullPrompt = promptBuilder.buildPrompt(
            prompt,
            type as TestType,
            platformType as PlatformType,
            customPrompt,
            acceptanceCriteria
        );

        // 2. Call Ollama with fresh instance + model config
        let rawResponse: string;
        try {
            const response = await ollama.generate({
                model: selectedModel,
                prompt: fullPrompt,
                format: "json",
                stream: false,
                options: modelConfig,
            });
            rawResponse = response.response;
        } catch (ollamaError) {
            const msg = ollamaError instanceof Error ? ollamaError.message : String(ollamaError);
            console.error("OLLAMA ERROR:", msg);
            return NextResponse.json(
                {
                    error: true,
                    result: `Could not reach Ollama. Make sure it is running and "${selectedModel}" is downloaded.\n\nRun: ollama pull ${selectedModel}`,
                },
                { status: 503 }
            );
        }

        // 3. Parse
        let parsedData;
        try {
            parsedData = responseParser.parse(rawResponse);
        } catch (parseError) {
            console.error("PARSE ERROR:", parseError);
            console.error("RAW RESPONSE SAMPLE:", rawResponse?.slice(0, 500));
            return NextResponse.json(
                {
                    error: true,
                    result: `The model returned a response that could not be parsed. Try again or switch to mistral:7b.\n\nModel used: ${selectedModel}`,
                },
                { status: 422 }
            );
        }

        // 4. Sanitize
        // 4. Sanitize + filter incomplete cases
        const sanitized = {
            testCases: (parsedData.testCases || [])
                .map((tc: any, index: number) => {
                    const num = String(index + 1).padStart(3, "0");
                    return {
                        testCaseId: String(tc.testCaseId || `TC-${num}`),
                        title: String(tc.title || ""),
                        testType: String(tc.testType || "Functional"),
                        priority: String(tc.priority || "Medium"),
                        preconditions: String(tc.preconditions || "None"),
                        testData: String(tc.testData || ""),
                        steps: String(tc.steps || ""),
                        expectedResult: String(tc.expectedResult || ""),
                    };
                })
                // Drop any test case that is missing critical fields
                .filter((tc) =>
                    tc.title.trim().length > 0 &&
                    tc.steps.trim().length > 0 &&
                    tc.expectedResult.trim().length > 0
                ),
        };

        if (sanitized.testCases.length === 0) {
            return NextResponse.json(
                { error: true, result: `Model responded but generated 0 test cases. Try a more specific prompt or switch models.` },
                { status: 422 }
            );
        }

        console.log(`SUCCESS: ${sanitized.testCases.length} test cases via ${selectedModel}`);

        return NextResponse.json({
            error: false,
            result: sanitized,
            meta: { model: selectedModel, count: sanitized.testCases.length, type, platformType },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("API ERROR:", errorMessage);
        return NextResponse.json(
            { error: true, result: `Unexpected error: ${errorMessage}` },
            { status: 500 }
        );
    }
}