import { join, relative } from 'path';
import { writeFileSync } from 'fs';
import { getProjectRoot } from '../automation/utils';
import type { RunArtifacts } from '../automation/types';
import type {
    AiProviderId,
    ProviderAttempt,
    ProviderOrchestratorResult,
    ProviderSettings,
} from '../ai/provider-orchestrator';
import type { ProviderGenerateRequest } from '../ai/providers/types';
import type { AiHealingSuggestion, DomCandidates, HealingChange, HealingEvidence } from './types';

export function nearbyCode(source: string, failedLine?: number) {
    const lines = source.split(/\r?\n/);
    if (!failedLine) return lines.slice(0, 80).join('\n');
    const start = Math.max(0, failedLine - 12);
    const end = Math.min(lines.length, failedLine + 12);
    return lines.slice(start, end).map((line, index) => `${start + index + 1}: ${line}`).join('\n');
}

export function buildAiHealingPrompt(params: {
    failedLocator?: string;
    errorMessage: string;
    testTitle: string;
    nearbyCode: string;
    domCandidates: DomCandidates;
    currentUrl?: string;
}) {
    return [
        'You are TCGen-Buddy Playwright Self-Healing V2.',
        'Return JSON only. Do not include markdown.',
        '',
        'Allowed patch types:',
        '- locator expressions',
        '- wait strategy',
        '- assertion normalization for safe whitespace/casing/dynamic formatting differences',
        '',
        'Forbidden patches:',
        '- test intent',
        '- credentials',
        '- business rules',
        '- expected business outcome',
        '- API endpoint',
        '- test data meaning',
        '',
        'Locator strategy order:',
        '1. data-testid',
        '2. getByRole',
        '3. getByLabel',
        '4. getByPlaceholder',
        '5. getByText',
        '6. aria-label',
        '7. stable CSS selector',
        '',
        'Avoid brittle XPath, dynamic classes, and nth-child unless no other option.',
        '',
        'Return exactly:',
        '{"canHeal":true,"healingType":"locator","originalCode":"...","healedCode":"...","reason":"...","confidence":0.86}',
        '',
        `Failed locator: ${params.failedLocator || 'Not detected'}`,
        `Error message: ${params.errorMessage}`,
        `Test title: ${params.testTitle}`,
        `Current URL: ${params.currentUrl || 'Unknown'}`,
        '',
        'Nearby code:',
        params.nearbyCode,
        '',
        'DOM candidates:',
        JSON.stringify(params.domCandidates, null, 2),
    ].join('\n');
}

export function parseAiHealingSuggestion(content: string): AiHealingSuggestion | undefined {
    const trimmed = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    try {
        const parsed = JSON.parse(trimmed) as Partial<AiHealingSuggestion>;
        if (
            typeof parsed.canHeal === 'boolean' &&
            ['locator', 'wait', 'assertion'].includes(String(parsed.healingType)) &&
            typeof parsed.originalCode === 'string' &&
            typeof parsed.healedCode === 'string' &&
            typeof parsed.reason === 'string' &&
            typeof parsed.confidence === 'number'
        ) {
            return parsed as AiHealingSuggestion;
        }
    } catch {}
    return undefined;
}

export function applyAiSuggestion(source: string, suggestion: AiHealingSuggestion | undefined, changes: HealingChange[]) {
    if (!suggestion?.canHeal || suggestion.confidence < 0.7) return source;
    if (!suggestion.originalCode.trim() || !suggestion.healedCode.trim()) return source;
    const next = source.replace(suggestion.originalCode, suggestion.healedCode);
    if (next !== source) {
        changes.push({
            kind: suggestion.healingType,
            original: suggestion.originalCode,
            replacement: suggestion.healedCode,
            reason: `AI-assisted healing: ${suggestion.reason}`,
        });
    }
    return next;
}

export async function requestAiHealingSuggestion(params: {
    source: string;
    evidence: HealingEvidence;
    domCandidates: DomCandidates;
    provider: AiProviderId;
    model?: string;
    providerSettings?: ProviderSettings;
    artifacts: RunArtifacts;
    generate: (
        provider: AiProviderId,
        request: ProviderGenerateRequest,
    ) => Promise<ProviderOrchestratorResult & { attempts: ProviderAttempt[] }>;
}) {
    const prompt = buildAiHealingPrompt({
        failedLocator: params.evidence.failedLocator,
        errorMessage: params.evidence.errorMessage,
        testTitle: params.evidence.testTitle,
        nearbyCode: nearbyCode(params.source, params.evidence.failedLineNumber),
        domCandidates: params.domCandidates,
        currentUrl: params.evidence.currentUrl,
    });
    const promptPath = join(params.artifacts.healingDir, 'ai-healing-prompt.txt');
    writeFileSync(promptPath, prompt, 'utf-8');
    const result = await params.generate(params.provider, {
        prompt,
        model: params.model,
        settings: params.providerSettings,
        responseFormat: 'json',
        temperature: 0,
        maxTokens: 1200,
    });
    return {
        suggestion: parseAiHealingSuggestion(result.content),
        promptPath: relative(getProjectRoot(), promptPath),
    };
}