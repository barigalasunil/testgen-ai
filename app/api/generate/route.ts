import { NextResponse } from "next/server";
import { promptBuilder, TestType, PlatformType } from "@/src/services/ai/prompt-builder";
import { responseParser } from "@/src/services/ai/response-parser";
import { resolveTestCasePrompt } from "@/src/orchestrators/testcase-orchestrator";
import { TestCase } from "@/src/modules/testcase-generator/types";
import { aiProviderOrchestrator, AiProviderId, ProviderSettings } from "@/src/services/ai/provider-orchestrator";
import { AiProviderError } from "@/src/services/ai/providers/types";
import { chunkRequirement } from "@/src/services/ai/requirement-chunker";

type ParsedModelTestCase = Partial<Record<keyof TestCase, unknown>>;

function generationStatusFor(error: unknown): number {
    const code = (error as { code?: string }).code;
    const status = (error as { status?: number }).status;

    if (status === 401 || status === 403 || code === 'MISSING_API_KEY') return 401;
    if (code === 'TIMEOUT' || code === 'MODEL_TIMEOUT') return 408;
    if (code === 'RATE_LIMIT' || code === 'QUOTA_EXCEEDED' || code === 'TOKEN_LIMIT') return 429;
    if (code === 'OLLAMA_OFFLINE' || code === 'NETWORK_ERROR' || code === 'PROVIDER_ERROR') return 503;
    if (code === 'MISSING_MODEL') return 400;
    return 500;
}

function providerErrorMessage(provider: string, error: unknown): string {
    const code = (error as { code?: string }).code;
    if (provider === 'ollama' && code === 'OLLAMA_OFFLINE') {
        return 'Ollama Local Offline';
    }
    if (provider === 'nvidia' && code === 'TIMEOUT') {
        return 'NVIDIA request timed out';
    }
    return error instanceof Error ? error.message : String(error);
}

function normalizeTestType(value: unknown): TestCase['testType'] {
    const allowed: TestCase['testType'][] = ['E2E', 'Negative', 'Edge', 'Security', 'Boundary', 'Resilience', 'Persona'];
    return allowed.includes(value as TestCase['testType']) ? value as TestCase['testType'] : 'E2E';
}

function normalizePriority(value: unknown): TestCase['priority'] {
    const allowed: TestCase['priority'][] = ['P1', 'P2', 'P3'];
    return allowed.includes(value as TestCase['priority']) ? value as TestCase['priority'] : 'P2';
}

export async function POST(req: Request) {
    try {
        const {
            prompt,
            model,
            provider = "auto",
            providerSettings,
            type = "functional",
            platformType = "web",
            customPrompt,
            acceptanceCriteria,
            jiraStoryId: requestJiraStoryId,
        } = await req.json();

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return NextResponse.json(
                { success: false, error: 'Prompt is required', code: 'INVALID_REQUEST' },
                { status: 400 }
            );
        }

        const resolvedPrompt = await resolveTestCasePrompt(prompt);
        const resolvedJiraStoryId = requestJiraStoryId || resolvedPrompt.jiraStoryId || null;

        let selectedModel = model || "auto";

        console.log(`[GENERATE] Provider: ${provider}, Jira: ${resolvedJiraStoryId || 'none'}`);

        const isAutomationMode = platformType === 'automation';

        const chunkedRequirement = chunkRequirement(resolvedPrompt.prompt);
        if (chunkedRequirement.chunkingApplied) {
            console.log(`[GENERATE] Requirement chunked into ${chunkedRequirement.chunks.length} chunks`);
        }

        const fullPrompt = isAutomationMode
            ? promptBuilder.buildAutomationPrompt(chunkedRequirement.prompt, customPrompt, acceptanceCriteria)
            : promptBuilder.buildPrompt(
                chunkedRequirement.prompt,
                type as TestType,
                platformType as PlatformType,
                customPrompt,
                acceptanceCriteria
            );

        if (isAutomationMode) {
            console.log('[GENERATE] Using Automation Workflow Mode with workflow-master.md orchestration');
        }

        let rawResponse: string;
        let providerMessage = '';
        let fallbackUsed = false;
        let providerUsed = '';
        let attempts: {
            provider?: string;
            model: string;
            status: 'success' | 'failed' | 'skipped';
            code?: string;
            reason?: string;
        }[] | undefined;

        try {
            const aiResult = await aiProviderOrchestrator.generate(provider as AiProviderId, {
                prompt: fullPrompt,
                model: selectedModel,
                settings: providerSettings as ProviderSettings | undefined,
                responseFormat: 'json',
                maxTokens: 4096,
                temperature: 0.2,
            });
            rawResponse = aiResult.content;
            fallbackUsed = aiResult.fallbackUsed;
            selectedModel = aiResult.modelUsed;
            providerUsed = aiResult.providerUsed;
            providerMessage = provider === 'auto'
                ? fallbackUsed
                    ? `AUTO -> ${providerUsed} Fallback (${selectedModel})`
                    : `AUTO -> ${providerUsed} Connected (${selectedModel})`
                : `${providerUsed} Connected (${selectedModel})`;
            attempts = aiResult.attempts.map((attempt) => ({
                provider: attempt.provider,
                model: `${attempt.provider}: ${attempt.model}`,
                status: attempt.status,
                code: attempt.code,
                reason: attempt.reason,
            }));
        } catch (error) {
            const msg = providerErrorMessage(String(provider), error);
            const attemptedProviders = (error as { attempts?: typeof attempts }).attempts || [];
            const code = error instanceof AiProviderError ? error.code : (error as { code?: string }).code || 'PROVIDER_ERROR';
            const status = generationStatusFor(error);
            console.error("[GENERATE] Provider error:", msg);
            return NextResponse.json(
                {
                    success: false,
                    error: msg,
                    code,
                    provider,
                    attemptedProviders,
                    result: msg,
                    message: msg,
                    meta: {
                        provider,
                        providerUsed: null,
                        fallbackUsed: false,
                        attempts: attemptedProviders,
                        message: provider === 'auto' ? 'All AI providers failed' : msg,
                    },
                },
                { status }
            );
        }

        let parsedData;
        try {
            parsedData = responseParser.parse(rawResponse);
        } catch (parseError) {
            console.error("[GENERATE] Parse error:", parseError);
            return NextResponse.json(
                { success: false, error: 'Could not parse model response. Try again or switch models.', code: 'INVALID_RESPONSE', result: 'Could not parse model response. Try again or switch models.' },
                { status: 500 }
            );
        }

        const jiraId = resolvedJiraStoryId;
        const projectKey = jiraId ? jiraId.split('-')[0] : resolvedPrompt.projectKey || 'TCGB';

        const sanitized = {
            testCases: (parsedData.testCases || [])
                .map((tc: ParsedModelTestCase, index: number) => {
                    const num = String(index + 1).padStart(3, "0");
                    return {
                        testCaseId: String(tc.testCaseId || `${jiraId || 'TC'}-${num}`),
                        scenarioTitle: String(tc.scenarioTitle || ""),
                        testType: normalizeTestType(tc.testType),
                        priority: normalizePriority(tc.priority),
                        preconditions: String(tc.preconditions || "None"),
                        testData: String(tc.testData || ""),
                        testSteps: String(tc.testSteps || ""),
                        expectedResult: String(tc.expectedResult || ""),
                        
                        // Traceability link
                        linkedRequirementId: jiraId,
                        projectKey: projectKey,
                        executionStatus: 'Untested' as const,
                    };
                })
                .filter((tc: TestCase) =>
                    tc.scenarioTitle.trim().length > 0 &&
                    tc.testSteps.trim().length > 0 &&
                    tc.expectedResult.trim().length > 0
                ),
        };

        if (sanitized.testCases.length === 0) {
            return NextResponse.json(
                { success: false, error: "Model returned 0 valid test cases. Try a more specific prompt.", code: 'INVALID_RESPONSE', result: "Model returned 0 valid test cases. Try a more specific prompt." },
                { status: 500 }
            );
        }

        console.log(`[GENERATE] Success: ${sanitized.testCases.length} test cases via ${selectedModel}`);

        return NextResponse.json({
            success: true,
            error: false,
            testCases: sanitized.testCases,
            providerUsed,
            modelUsed: selectedModel,
            result: sanitized,
            meta: {
                model: selectedModel,
                activeModel: selectedModel,
                provider,
                providerUsed,
                count: sanitized.testCases.length,
                type: isAutomationMode ? 'automation' : type,
                platformType,
                jiraStoryId: jiraId,
                fallbackUsed,
                attempts,
                chunkingApplied: chunkedRequirement.chunkingApplied,
                chunkCount: chunkedRequirement.chunks.length,
                message: isAutomationMode
                    ? `Automation Workflow: ${sanitized.testCases.length} automation-ready test cases (${providerMessage || providerUsed})`
                    : providerMessage,
            },
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[GENERATE] Unexpected error:", msg);
        return NextResponse.json(
            { success: false, error: `Unexpected error: ${msg}`, code: 'UNEXPECTED_ERROR', result: `Unexpected error: ${msg}` },
            { status: 500 }
        );
    }
}
