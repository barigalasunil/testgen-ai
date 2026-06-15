import { NextResponse } from "next/server";
import { promptBuilder, TestType, PlatformType } from "@/src/services/ai/prompt-builder";
import { responseParser } from "@/src/services/ai/response-parser";
import { resolveTestCasePrompt } from "@/src/orchestrators/testcase-orchestrator";
import { TestCase } from "@/src/modules/testcase-generator/types";
import { aiProviderOrchestrator, AiProviderId, ProviderSettings } from "@/src/services/ai/provider-orchestrator";
import { AiProviderError } from "@/src/services/ai/providers/types";
import { chunkRequirement } from "@/src/services/ai/requirement-chunker";
import { getTokenBudget, safeCharsForProvider } from "@/src/services/ai/token-budget";

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

function sanitizeTestCases(rawCases: ParsedModelTestCase[], jiraId: string | null, projectKey: string): TestCase[] {
    return rawCases
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
                linkedRequirementId: jiraId || undefined,
                projectKey,
                executionStatus: 'Untested' as const,
            };
        })
        .filter((tc: TestCase) =>
            tc.scenarioTitle.trim().length > 0 &&
            tc.testSteps.trim().length > 0 &&
            tc.expectedResult.trim().length > 0
        );
}

function dedupeAndRenumber(testCases: TestCase[], jiraId: string | null): TestCase[] {
    const seen = new Set<string>();
    const deduped: TestCase[] = [];

    for (const testCase of testCases) {
        const key = [
            testCase.scenarioTitle.trim().toLowerCase(),
            testCase.testSteps.trim().toLowerCase(),
            testCase.expectedResult.trim().toLowerCase(),
        ].join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(testCase);
    }

    return deduped.map((testCase, index) => ({
        ...testCase,
        testCaseId: `${jiraId || 'TC'}-${String(index + 1).padStart(3, "0")}`,
    }));
}

function buildChunkPrompt(basePrompt: string, chunkText: string, chunkIndex: number, totalChunks: number) {
    if (totalChunks <= 1) return basePrompt;
    return [
        basePrompt,
        "",
        "CHUNK-WISE GENERATION MODE:",
        `Generate test cases only for chunk ${chunkIndex} of ${totalChunks}.`,
        "Do not cover behavior that is not present in this chunk.",
        "Return valid JSON with a testCases array only.",
    ].join("\n");
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
            memoryContext,
        } = await req.json();

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return NextResponse.json(
                { success: false, error: 'Prompt is required', code: 'INVALID_REQUEST' },
                { status: 400 }
            );
        }

        const resolvedPrompt = await resolveTestCasePrompt(prompt);
        const promptWithMemory = typeof memoryContext === 'string' && memoryContext.trim()
            ? `${memoryContext.trim()}\n\nCURRENT GENERATION REQUEST:\n${resolvedPrompt.prompt}`
            : resolvedPrompt.prompt;
        const resolvedJiraStoryId = requestJiraStoryId || resolvedPrompt.jiraStoryId || null;

        let selectedModel = model || "auto";

        console.log(`[GENERATE] Provider: ${provider}, Jira: ${resolvedJiraStoryId || 'none'}`);

        const isAutomationMode = platformType === 'automation';

        const activeProvider = provider as AiProviderId;
        const budget = getTokenBudget(activeProvider);
        const maxChunkChars = safeCharsForProvider(activeProvider);
        const chunkedRequirement = chunkRequirement(promptWithMemory, maxChunkChars);
        if (chunkedRequirement.chunkingApplied) {
            console.log(`[GENERATE] Requirement chunked into ${chunkedRequirement.chunks.length} chunks (safe input ${budget.safeInputTokens} tokens)`);
        }

        const basePrompt = isAutomationMode
            ? promptBuilder.buildAutomationPrompt("{{CHUNK_REQUIREMENT}}", customPrompt, acceptanceCriteria)
            : promptBuilder.buildPrompt(
                "{{CHUNK_REQUIREMENT}}",
                type as TestType,
                platformType as PlatformType,
                customPrompt,
                acceptanceCriteria
            );

        if (isAutomationMode) {
            console.log('[GENERATE] Using Automation Workflow Mode with workflow-master.md orchestration');
        }

        let providerMessage = '';
        let fallbackUsed = false;
        let providerUsed = '';
        const attempts: {
            provider?: string;
            model: string;
            status: 'success' | 'failed' | 'skipped';
            code?: string;
            reason?: string;
        }[] = [];
        const jiraId = resolvedJiraStoryId;
        const projectKey = jiraId ? jiraId.split('-')[0] : resolvedPrompt.projectKey || 'TCGB';
        const generatedCases: TestCase[] = [];
        const failedChunks: { chunk: number; error: string; code?: string }[] = [];

        for (const chunk of chunkedRequirement.chunks) {
            console.log(`[GENERATE] Generating chunk ${chunk.index}/${chunk.total}`);
            const chunkPromptBody = buildChunkPrompt(
                basePrompt.replace("{{CHUNK_REQUIREMENT}}", chunk.text),
                chunk.text,
                chunk.index,
                chunk.total
            );

            try {
                const aiResult = await aiProviderOrchestrator.generate(activeProvider, {
                    prompt: chunkPromptBody,
                    model: selectedModel,
                    settings: providerSettings as ProviderSettings | undefined,
                    responseFormat: 'json',
                    maxTokens: budget.maxOutputTokens,
                    temperature: 0.2,
                });

                fallbackUsed = fallbackUsed || aiResult.fallbackUsed;
                selectedModel = aiResult.modelUsed;
                providerUsed = aiResult.providerUsed;
                providerMessage = activeProvider === 'auto'
                    ? aiResult.fallbackUsed
                        ? `Generating chunk ${chunk.index} of ${chunk.total} via ${providerUsed} fallback (${selectedModel})`
                        : `Generating chunk ${chunk.index} of ${chunk.total} via ${providerUsed} (${selectedModel})`
                    : `Generating chunk ${chunk.index} of ${chunk.total} via ${providerUsed} (${selectedModel})`;
                attempts.push(...aiResult.attempts.map((attempt) => ({
                    provider: attempt.provider,
                    model: `${attempt.provider}: ${attempt.model}`,
                    status: attempt.status,
                    code: attempt.code,
                    reason: `Chunk ${chunk.index}: ${attempt.reason || attempt.status}`,
                })));

                const parsedData = responseParser.parse(aiResult.content);
                generatedCases.push(...sanitizeTestCases(parsedData.testCases || [], jiraId, projectKey));
            } catch (error) {
                const msg = providerErrorMessage(String(provider), error);
                const code = error instanceof AiProviderError ? error.code : (error as { code?: string }).code || 'PROVIDER_ERROR';
                const attemptedProviders = (error as { attempts?: typeof attempts }).attempts || [];
                attempts.push(...attemptedProviders.map((attempt) => ({
                    ...attempt,
                    reason: `Chunk ${chunk.index}: ${attempt.reason || attempt.status}`,
                })));
                failedChunks.push({ chunk: chunk.index, error: msg, code });
                console.error(`[GENERATE] Chunk ${chunk.index}/${chunk.total} failed:`, msg);
            }
        }

        const sanitized = {
            testCases: dedupeAndRenumber(generatedCases, jiraId),
        };

        if (sanitized.testCases.length === 0) {
            const firstFailure = failedChunks[0];
            return NextResponse.json(
                {
                    success: false,
                    error: "Generation failed across all providers/models.",
                    code: firstFailure?.code || 'PROVIDER_ERROR',
                    result: "Generation failed across all providers/models.",
                    meta: {
                        provider,
                        providerUsed: null,
                        fallbackUsed,
                        attempts,
                        failedChunks,
                        message: "Generation failed across all providers/models.",
                    },
                },
                { status: firstFailure ? generationStatusFor(firstFailure) : 500 }
            );
        }

        console.log(`[GENERATE] Success: ${sanitized.testCases.length} test cases via ${selectedModel}`);
        const partialWarning = failedChunks.length > 0
            ? `${failedChunks.length} chunk${failedChunks.length === 1 ? '' : 's'} failed. Showing partial results.`
            : "";

        return NextResponse.json({
            success: true,
            error: false,
            warning: partialWarning || undefined,
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
                failedChunks,
                partial: failedChunks.length > 0,
                chunkingApplied: chunkedRequirement.chunkingApplied,
                chunkCount: chunkedRequirement.chunks.length,
                message: isAutomationMode
                    ? `Automation Workflow: ${sanitized.testCases.length} automation-ready test cases (${partialWarning || providerMessage || providerUsed})`
                    : partialWarning || providerMessage,
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
