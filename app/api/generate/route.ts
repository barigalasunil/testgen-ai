import { NextResponse } from "next/server";
import { OllamaService } from "@/src/services/ai/ollama.service";
import { promptBuilder, TestType, PlatformType } from "@/src/services/ai/prompt-builder";
import { responseParser } from "@/src/services/ai/response-parser";
import { resolveTestCasePrompt } from "@/src/orchestrators/testcase-orchestrator";

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
            provider = "local",
            type = "functional",
            platformType = "web",
            customPrompt,
            acceptanceCriteria,
            jiraStoryId: requestJiraStoryId,
        } = await req.json();

        const resolvedPrompt = await resolveTestCasePrompt(prompt);
        const resolvedJiraStoryId = requestJiraStoryId || resolvedPrompt.jiraStoryId || null;

        // 1. Resolve Model and Config
        let selectedModel = model || "mistral:7b";
        if (provider === 'local') {
            selectedModel = await resolveModel(selectedModel);
        }
        const modelConfig = getModelConfig(selectedModel);

        console.log(`[GENERATE] Provider: ${provider}, Model: ${selectedModel}, Jira: ${resolvedJiraStoryId || 'none'}`);

        const isAutomationMode = platformType === 'automation';

        const fullPrompt = isAutomationMode
            ? promptBuilder.buildAutomationPrompt(resolvedPrompt.prompt, customPrompt, acceptanceCriteria)
            : promptBuilder.buildPrompt(
                resolvedPrompt.prompt,
                type as TestType,
                platformType as PlatformType,
                customPrompt,
                acceptanceCriteria
            );

        if (isAutomationMode) {
            console.log('[GENERATE] Using Automation Workflow Mode with workflow-master.md orchestration');
        }

        let rawResponse: string;
        try {
            if (provider === 'cloud' && process.env.OPENROUTER_API_KEY) {
                console.log('[GENERATE] Routing to OpenRouter (CLOUD)');
                rawResponse = await ollama.generateWithOpenRouter(fullPrompt, model !== 'auto' ? model : undefined);
            } else if (provider === 'local') {
                console.log('[GENERATE] Routing to Ollama (LOCAL)');
                try {
                    const response = await ollama.generate({
                        model: selectedModel,
                        prompt: fullPrompt,
                        format: "json",
                        stream: false,
                        options: modelConfig,
                    });
                    rawResponse = response.response;
                } catch (error: any) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.warn('[GENERATE] Local Ollama failed:', message);
                    if (process.env.OPENROUTER_API_KEY) {
                        console.log('[GENERATE] Falling back to OpenRouter because local provider failed');
                        rawResponse = await ollama.generateWithOpenRouter(fullPrompt, model !== 'auto' ? model : undefined);
                    } else {
                        throw error;
                    }
                }
            } else {
                // AUTO mode or Fallback
                try {
                    console.log('[GENERATE] Auto-Mode: Trying LOCAL first');
                    const response = await ollama.generate({
                        model: selectedModel,
                        prompt: fullPrompt,
                        format: "json",
                        stream: false,
                        options: modelConfig,
                    });
                    rawResponse = response.response;
                } catch {
                    console.log('[GENERATE] Auto-Mode: LOCAL failed, falling back to CLOUD');
                    rawResponse = await ollama.generateWithOpenRouter(fullPrompt);
                }
            }
        } catch (error: any) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error("[GENERATE] Provider error:", msg);
            return NextResponse.json(
                { error: true, result: `Generation error: ${msg}` },
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

        const jiraId = resolvedJiraStoryId;
        const projectKey = jiraId ? jiraId.split('-')[0] : resolvedPrompt.projectKey || 'TCGB';

        const sanitized = {
            testCases: (parsedData.testCases || [])
                .map((tc: any, index: number) => {
                    const num = String(index + 1).padStart(3, "0");
                    return {
                        testCaseId: String(tc.testCaseId || `${jiraId || 'TC'}-${num}`),
                        scenarioTitle: String(tc.scenarioTitle || ""),
                        testType: String(tc.testType || "E2E"),
                        priority: String(tc.priority || "P2"),
                        preconditions: String(tc.preconditions || "None"),
                        testData: String(tc.testData || ""),
                        testSteps: String(tc.testSteps || ""),
                        expectedResult: String(tc.expectedResult || ""),
                        
                        // Traceability link
                        linkedRequirementId: jiraId,
                        projectKey: projectKey,
                        executionStatus: 'Untested'
                    };
                })
                .filter((tc: any) =>
                    tc.scenarioTitle.trim().length > 0 &&
                    tc.testSteps.trim().length > 0 &&
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
            meta: {
                model: selectedModel,
                count: sanitized.testCases.length,
                type: isAutomationMode ? 'automation' : type,
                platformType,
                jiraStoryId: jiraId,
                message: isAutomationMode
                    ? `Automation Workflow: ${sanitized.testCases.length} automation-ready test cases`
                    : undefined,
            },
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