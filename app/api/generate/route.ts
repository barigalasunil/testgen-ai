import { NextResponse } from "next/server";
import { promptBuilder, TestType, PlatformType } from "@/src/services/ai/prompt-builder";
import { responseParser } from "@/src/services/ai/response-parser";
import { AUTO_MODEL } from "@/src/services/ai/modelConfig";
import { ModelAttempt, ModelManager, ModelManagerError } from "@/src/services/ai/modelManager";

type ParsedTestCase = {
    testCaseId?: string;
    title?: string;
    testType?: string;
    priority?: string;
    preconditions?: string;
    testData?: string;
    steps?: string;
    expectedResult?: string;
};

type ParsedTestCases = {
    testCases?: ParsedTestCase[];
};

export async function POST(req: Request) {
    const modelManager = new ModelManager();

    try {
        const {
            prompt,
            model,
            type = "functional",
            platformType = "web",
            customPrompt,
            acceptanceCriteria,
        } = await req.json();

        const selectedModel = model || AUTO_MODEL;

        console.log("GENERATION REQUEST:", { prompt, selectedModel, type, platformType });

        const fullPrompt = promptBuilder.buildPrompt(
            prompt,
            type as TestType,
            platformType as PlatformType,
            customPrompt,
            acceptanceCriteria
        );

        let rawResponse: string;
        let activeModel = selectedModel;
        let attempts: ModelAttempt[] = [];
        let fallbackUsed = false;
        let modelMessage = `Using: ${selectedModel}`;

        try {
            const generation = await modelManager.generate({
                model: selectedModel,
                prompt: fullPrompt,
                format: "json",
                stream: false,
            });
            rawResponse = generation.response.response;
            activeModel = generation.model;
            attempts = generation.attempts;
            fallbackUsed = generation.fallbackUsed;
            modelMessage = generation.message;
        } catch (ollamaError) {
            const msg = ollamaError instanceof Error ? ollamaError.message : String(ollamaError);
            if (ollamaError instanceof ModelManagerError) {
                attempts = ollamaError.attempts;
            }
            console.error("OLLAMA ERROR:", msg);
            return NextResponse.json(
                {
                    error: true,
                    result: msg,
                    meta: {
                        requestedModel: selectedModel,
                        activeModel: null,
                        mode: selectedModel === AUTO_MODEL ? "auto" : "manual",
                        attempts,
                        fallbackUsed,
                    },
                },
                { status: 503 }
            );
        }

        let parsedData: ParsedTestCases;
        try {
            parsedData = responseParser.parse(rawResponse);
        } catch (parseError) {
            console.error("PARSE ERROR:", parseError);
            console.error("RAW RESPONSE SAMPLE:", rawResponse?.slice(0, 500));
            return NextResponse.json(
                {
                    error: true,
                    result: `The model returned a response that could not be parsed. Retry generation or switch models.\n\nModel used: ${activeModel}`,
                    meta: {
                        requestedModel: selectedModel,
                        activeModel,
                        attempts,
                        fallbackUsed,
                        message: modelMessage,
                    },
                },
                { status: 422 }
            );
        }

        const sanitized = {
            testCases: (parsedData.testCases || [])
                .map((tc: ParsedTestCase, index: number) => {
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
                .filter((tc) =>
                    tc.title.trim().length > 0 &&
                    tc.steps.trim().length > 0 &&
                    tc.expectedResult.trim().length > 0
                ),
        };

        if (sanitized.testCases.length === 0) {
            return NextResponse.json(
                {
                    error: true,
                    result: "Model responded but generated 0 complete test cases. Retry generation or switch models.",
                    meta: {
                        requestedModel: selectedModel,
                        activeModel,
                        attempts,
                        fallbackUsed,
                        message: modelMessage,
                    },
                },
                { status: 422 }
            );
        }

        console.log(`SUCCESS: ${sanitized.testCases.length} test cases via ${activeModel}`);

        return NextResponse.json({
            error: false,
            result: sanitized,
            meta: {
                model: activeModel,
                requestedModel: selectedModel,
                count: sanitized.testCases.length,
                type,
                platformType,
                attempts,
                fallbackUsed,
                message: modelMessage,
            },
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
