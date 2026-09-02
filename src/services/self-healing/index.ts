import { join, basename } from 'path';
import { existsSync, copyFileSync, unlinkSync, readFileSync } from 'fs';
import { getProjectRoot } from '../automation/utils';
import { classifyFailure } from './classifier';
import { collectHealingEvidence } from './evidence';
import { collectDomCandidates } from './dom';
import { requestAiHealingSuggestion } from './ai';
import { createHealedScript, buildFailedOnlyGrep } from './healers';
import { writeHealingReport } from './report';
import type { RunArtifacts } from '../automation/types';
import type { BrowserName, PlaywrightRunResult } from '../automation/types';
import type { AiProviderId, ProviderSettings } from '../ai/provider-orchestrator';
import type { AiHealingSuggestion, HealingAttemptResult } from './types';

export async function runHealedScript(healedScriptPath: string, grep: string | undefined, artifacts: RunArtifacts, options: {
    headed: boolean;
    browser: BrowserName;
    incognito?: boolean;
}, runPlaywright: (args: string[], artifacts: RunArtifacts, options: { headed: boolean; browser: BrowserName; incognito?: boolean; suiteName: string; suiteApp: string }) => Promise<PlaywrightRunResult>) {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const configPath = join(automationDir, 'playwright.config.ts');
    const tempTestFile = `_healed_${basename(healedScriptPath)}`;
    const tempTestPath = join(automationDir, 'tests', tempTestFile);
    copyFileSync(healedScriptPath, tempTestPath);
    try {
        const args = ['playwright', 'test', `tests/${tempTestFile}`, '--config', configPath];
        if (grep) args.push('--grep', grep);
        if (options.browser !== 'all') args.push('--project', options.browser);
        return await runPlaywright(args, artifacts, {
            ...options,
            suiteName: 'healed',
            suiteApp: 'Healed Script',
        });
    } finally {
        try {
            unlinkSync(tempTestPath);
        } catch {}
    }
}

export async function attemptSelfHealing(params: {
    artifacts: RunArtifacts;
    result: PlaywrightRunResult;
    failedTests: string[];
    sourceCode?: string;
    sourceFile?: string;
    suite: string;
    headed: boolean;
    browser: BrowserName;
    incognito?: boolean;
    aiProvider: AiProviderId;
    aiModel?: string;
    providerSettings?: ProviderSettings;
    linkedStoryId?: string;
    log: (message: string) => void | Promise<void>;
    runPlaywright: (
        args: string[],
        artifacts: RunArtifacts,
        options: { headed: boolean; browser: BrowserName; incognito?: boolean; suiteName: string; suiteApp: string },
    ) => Promise<PlaywrightRunResult>;
    generate: (
        provider: AiProviderId,
        request: import('../ai/providers/types').ProviderGenerateRequest,
    ) => Promise<import('../ai/provider-orchestrator').ProviderOrchestratorResult & { attempts: import('../ai/provider-orchestrator').ProviderAttempt[] }>;
}): Promise<HealingAttemptResult> {
    const output = `${params.result.output || ''}\n${params.result.stderr || ''}`;
    const classification = classifyFailure(output);
    const evidence = collectHealingEvidence({
        artifacts: params.artifacts,
        result: params.result,
        failedTests: params.failedTests,
        sourceFile: params.sourceFile,
        browser: params.browser,
        suite: params.suite,
    });
    await params.log(`[Healing] Failure classified: ${classification.type}`);

    const baseAttempt: HealingAttemptResult = {
        attempted: false,
        finalStatus: classification.category === 'NOT_HEALABLE' ? 'NOT_HEALABLE' : 'NEEDS_MANUAL_REVIEW',
        classification,
        evidence,
        changes: [],
        originalLocator: evidence.failedLocator,
        confidence: classification.confidence,
        reason: classification.reason,
    };

    if (classification.category !== 'HEALABLE') {
        await params.log(`[Healing] Not healable: ${classification.rootCause}`);
        baseAttempt.memoryVaultEvent = {
            sourceType: 'self_healing_event',
            runId: params.artifacts.runId,
            suite: params.suite,
            testTitle: evidence.testTitle,
            failureType: classification.type,
            originalLocator: evidence.failedLocator,
            finalStatus: baseAttempt.finalStatus,
            confidence: classification.confidence,
            linkedAutomationRunId: params.artifacts.runId,
            linkedStoryId: params.linkedStoryId,
            createdAt: new Date().toISOString(),
        };
        writeHealingReport({ artifacts: params.artifacts, attempt: baseAttempt });
        return baseAttempt;
    }

    await params.log('[Healing] Healing started');
    if (classification.type === 'LOCATOR_NOT_FOUND') await params.log('[Healing] Locator failure detected');
    const dom = await collectDomCandidates(evidence.currentUrl, params.artifacts);
    await params.log(`[Healing] DOM candidates collected: ${dom.count}`);

    let aiSuggestion: AiHealingSuggestion | undefined;
    let aiPromptPath: string | undefined;
    const source = params.sourceCode ?? (params.sourceFile && existsSync(params.sourceFile) ? readFileSync(params.sourceFile, 'utf-8') : '');
    if (source.trim()) {
        try {
            const ai = await requestAiHealingSuggestion({
                source,
                evidence,
                domCandidates: dom.candidates,
                provider: params.aiProvider,
                model: params.aiModel,
                providerSettings: params.providerSettings,
                artifacts: params.artifacts,
                generate: params.generate,
            });
            aiSuggestion = ai.suggestion;
            aiPromptPath = ai.promptPath;
            if (aiSuggestion?.canHeal) {
                await params.log('[Healing] AI suggested replacement locator');
            } else {
                await params.log('[Healing] AI did not return a safe healing suggestion');
            }
        } catch (error) {
            await params.log(`[Healing] AI-assisted healing unavailable: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    if (aiSuggestion?.canHeal && aiSuggestion.confidence < 0.7) {
        const lowConfidenceAttempt: HealingAttemptResult = {
            ...baseAttempt,
            finalStatus: 'NEEDS_MANUAL_REVIEW',
            attempted: true,
            changes: [],
            confidence: aiSuggestion.confidence,
            reason: `AI confidence below auto-apply threshold: ${aiSuggestion.reason}`,
            domCandidatesPath: dom.path,
            domCandidateCount: dom.count,
            aiSuggestion,
            aiPromptPath,
            memoryVaultEvent: {
                sourceType: 'self_healing_event',
                runId: params.artifacts.runId,
                suite: params.suite,
                testTitle: evidence.testTitle,
                failureType: classification.type,
                originalLocator: evidence.failedLocator,
                finalStatus: 'NEEDS_MANUAL_REVIEW',
                confidence: aiSuggestion.confidence,
                linkedAutomationRunId: params.artifacts.runId,
                linkedStoryId: params.linkedStoryId,
                createdAt: new Date().toISOString(),
            },
        };
        await params.log('[Healing] Needs Manual Review');
        writeHealingReport({ artifacts: params.artifacts, attempt: lowConfidenceAttempt });
        return lowConfidenceAttempt;
    }

    const created = createHealedScript({
        artifacts: params.artifacts,
        sourceCode: params.sourceCode,
        sourceFile: params.sourceFile,
        classification,
        output,
        failedLocator: evidence.failedLocator,
        evidence,
        aiSuggestion,
    });

    const attempt: HealingAttemptResult = {
        ...baseAttempt,
        attempted: true,
        healedScriptPath: created.healedScriptPath,
        changes: created.changes,
        replacementLocator: created.changes.find(change => change.kind === 'locator')?.replacement,
        confidence: Math.max(classification.confidence, aiSuggestion?.confidence || 0),
        reason: aiSuggestion?.reason || classification.reason,
        domCandidatesPath: dom.path,
        domCandidateCount: dom.count,
        aiSuggestion,
        aiPromptPath,
    };

    if (!created.healedScriptPath || created.changes.length === 0) {
        attempt.finalStatus = 'NEEDS_MANUAL_REVIEW';
        attempt.error = 'No safe automatic code change was available.';
        await params.log('[Healing] No safe automatic code change was available');
        attempt.memoryVaultEvent = {
            sourceType: 'self_healing_event',
            runId: params.artifacts.runId,
            suite: params.suite,
            testTitle: evidence.testTitle,
            failureType: classification.type,
            originalLocator: evidence.failedLocator,
            finalStatus: attempt.finalStatus,
            confidence: attempt.confidence,
            linkedAutomationRunId: params.artifacts.runId,
            linkedStoryId: params.linkedStoryId,
            healedScriptPath: created.healedScriptPath,
            createdAt: new Date().toISOString(),
        };
        writeHealingReport({ artifacts: params.artifacts, attempt });
        return attempt;
    }

    for (const change of created.changes) {
        await params.log(`[Healing] ${change.kind === 'locator' ? 'Locator healed' : change.kind === 'wait' ? 'Wait healed' : 'Assertion healed'}: ${change.original} -> ${change.replacement}`);
    }
    await params.log('[Healing] Healed script saved');

    const grep = buildFailedOnlyGrep(evidence.testTitles);
    attempt.failedOnlyGrep = grep;
    for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber += 1) {
        await params.log(`[Healing] Re-running failed test (attempt ${attemptNumber}/3)`);
        const rerun = await runHealedScript(created.healedScriptPath, grep, params.artifacts, {
            headed: params.headed,
            browser: params.browser,
            incognito: params.incognito,
        }, params.runPlaywright);
        attempt.rerunResult = rerun;
        if (rerun.success) {
            attempt.finalStatus = 'AUTO_HEALED';
            attempt.memoryVaultEvent = {
                sourceType: 'self_healing_event',
                runId: params.artifacts.runId,
                suite: params.suite,
                testTitle: evidence.testTitle,
                failureType: classification.type,
                originalLocator: evidence.failedLocator,
                healedLocator: attempt.replacementLocator,
                finalStatus: attempt.finalStatus,
                confidence: attempt.confidence,
                linkedAutomationRunId: params.artifacts.runId,
                linkedStoryId: params.linkedStoryId,
                healedScriptPath: created.healedScriptPath,
                createdAt: new Date().toISOString(),
            };
            await params.log('[Healing] Auto-Healed');
            writeHealingReport({ artifacts: params.artifacts, attempt });
            return attempt;
        }
        await params.log('[Healing] Re-run failed');
    }

    attempt.finalStatus = created.changes.length > 0 ? 'PARTIALLY_HEALED' : 'NEEDS_MANUAL_REVIEW';
    attempt.memoryVaultEvent = {
        sourceType: 'self_healing_event',
        runId: params.artifacts.runId,
        suite: params.suite,
        testTitle: evidence.testTitle,
        failureType: classification.type,
        originalLocator: evidence.failedLocator,
        healedLocator: attempt.replacementLocator,
        finalStatus: attempt.finalStatus,
        confidence: attempt.confidence,
        linkedAutomationRunId: params.artifacts.runId,
        linkedStoryId: params.linkedStoryId,
        healedScriptPath: created.healedScriptPath,
        createdAt: new Date().toISOString(),
    };
    writeHealingReport({ artifacts: params.artifacts, attempt });
    return attempt;
}

export type { HealingAttemptResult } from './types';
