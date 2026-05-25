import { NextResponse } from "next/server";
import { OllamaService } from "@/src/services/ai/ollama.service";
import { promptBuilder, TestType, PlatformType } from "@/src/services/ai/prompt-builder";
import { responseParser } from "@/src/services/ai/response-parser";

const MODEL_CONFIG: Record<string, { num_predict: number; temperature: number; top_p: number }> = {
    "phi3:mini":          { num_predict: 3000, temperature: 0.2,  top_p: 0.9  },
    "mistral:7b":         { num_predict: 6000, temperature: 0.3,  top_p: 0.95 },
    "gemma4:e4b":         { num_predict: 6000, temperature: 0.25, top_p: 0.92 },
    "gemma3:12b":         { num_predict: 6000, temperature: 0.25, top_p: 0.92 },
    "qwen3:1.7b":         { num_predict: 4000, temperature: 0.25, top_p: 0.92 },
    "qwen3:1.7b-q4_K_M":  { num_predict: 4000, temperature: 0.25, top_p: 0.92 },
    "granite3.3:2b":      { num_predict: 4000, temperature: 0.25, top_p: 0.92 },
    "stablelm2":          { num_predict: 2000, temperature: 0.2,  top_p: 0.9  },
};

const DEFAULT_CONFIG = { num_predict: 4096, temperature: 0.3, top_p: 0.95 };

function getModelConfig(model: string) {
    const key = Object.keys(MODEL_CONFIG).find(k =>
        model.startsWith(k.split(':')[0])
    );
    return key ? MODEL_CONFIG[key] : DEFAULT_CONFIG;
}

async function resolveModel(requested: string): Promise<string> {
    const preferenceOrder = [
        'qwen3:1.7b',
        'qwen3:1.7b-q4_K_M',
        'granite3.3:2b',
        'phi3:mini',
        'mistral:7b',
        'gemma4:e4b',
        'stablelm2',
        'gemma3:12b',
    ];

    try {
        const res = await fetch('http://127.0.0.1:11434/api/tags', {
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return requested;

        const data = await res.json() as { models: { name: string }[] };
        const available = data.models.map(m => m.name);

        console.log('[GENERATE] Available models:', available);

        if (available.length === 0) return requested;

        // Exact match
        if (available.includes(requested)) return requested;

        // Prefix match
        const prefix = requested.split(':')[0];
        const prefixMatch = available.find(m => m.startsWith(prefix));
        if (prefixMatch) return prefixMatch;

        // Auto-fallback — smallest preferred model
        for (const pref of preferenceOrder) {
            const found = available.find(m =>
                m === pref || m.startsWith(pref.split(':')[0])
            );
            if (found) {
                console.warn(`[GENERATE] ${requested} not found, using ${found}`);
                return found;
            }
        }

        return available[0];
    } catch {
        return requested;
    }
}

export async function POST(req: Request) {
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

        const selectedModel = await resolveModel(model || "mistral:7b");
        const modelConfig = getModelConfig(selectedModel);

        console.log("[GENERATE] Model resolved:", selectedModel);
        console.log("[GENERATE] Config:", modelConfig);

        const fullPrompt = promptBuilder.buildPrompt(
            prompt,
            type as TestType,
            platformType as PlatformType,
            customPrompt,
            acceptanceCriteria
        );

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
            console.error("[GENERATE] Ollama error:", msg);
            return NextResponse.json(
                { error: true, result: `Model error: ${msg}` },
                { status: 503 }
            );
        }

        let parsedData;
        try {
            parsedData = responseParser.parse(rawResponse);
        } catch (parseError) {
            console.error("[GENERATE] Parse error:", parseError);
            return NextResponse.json(
                { error: true, result: `Could not parse model response. Try again or switch models.` },
                { status: 422 }
            );
        }

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
                .filter((tc: any) =>
                    tc.title.trim().length > 0 &&
                    tc.steps.trim().length > 0 &&
                    tc.expectedResult.trim().length > 0
                ),
        };

        if (sanitized.testCases.length === 0) {
            return NextResponse.json(
                { error: true, result: "Model returned 0 valid test cases. Try a more specific prompt." },
                { status: 422 }
            );
        }

        console.log(`[GENERATE] Success: ${sanitized.testCases.length} test cases via ${selectedModel}`);

        return NextResponse.json({
            error: false,
            result: sanitized,
            meta: { model: selectedModel, count: sanitized.testCases.length, type, platformType },
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[GENERATE] Unexpected error:", msg);
        return NextResponse.json(
            { error: true, result: `Unexpected error: ${msg}` },
            { status: 500 }
        );
    }
}