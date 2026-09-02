import { join, basename } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { stripAnsi } from './classifier';
import { applyAiSuggestion } from './ai';
import { getProjectRoot, sanitizeFilePart } from '../automation/utils';
import type { RunArtifacts } from '../automation/types';
import type { AiHealingSuggestion, FailureClassification, HealingChange, HealingEvidence } from './types';

export function replacementForLocator(originalLocator: string) {
    const selector = originalLocator.replace(/^['"`]|['"`]$/g, '');
    const idMatch = selector.match(/^#([a-z0-9_-]+)$/i);
    const dataTestMatch = selector.match(/\[data-test(?:id)?=["']([^"']+)["']\]/i);
    const textMatch = selector.match(/text=(.+)/i);
    const normalizeToken = (value: string) => value
        .replace(/[-_](broken|missing|wrong|invalid|old|stale)$/i, '')
        .replace(/[-_]+$/, '');

    if (dataTestMatch?.[1]) {
        return { locator: `getByTestId('${normalizeToken(dataTestMatch[1])}')`, reason: 'Prefer data-test/data-testid selector.' };
    }
    if (idMatch?.[1]) {
        const id = normalizeToken(idMatch[1]);
        if (/button|login|submit|checkout|continue|finish|cancel|remove|add/i.test(id)) {
            const buttonName = id.replace(/[-_]*button$/i, '').replace(/[-_]+/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return { locator: `getByRole('button', { name: /${buttonName}/i })`, reason: 'Use accessible role before falling back to CSS.' };
        }
        return { locator: `getByTestId('${id}')`, reason: 'Try project data-test attribute derived from stable id.' };
    }
    if (textMatch?.[1]) {
        return { locator: `getByText(/${textMatch[1].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i)`, reason: 'Use text locator with case-insensitive matching.' };
    }
    if (/^\.[a-z0-9_-]+$/i.test(selector)) {
        return { locator: `locator('${selector}:visible')`, reason: 'Retain stable CSS selector but require visible element.' };
    }
    return undefined;
}

export function applyLocatorHealing(source: string, failedLocator: string | undefined, changes: HealingChange[]) {
    if (!failedLocator) return source;
    const replacement = replacementForLocator(failedLocator);
    if (!replacement) return source;
    const escaped = failedLocator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const locatorCall = new RegExp(`\\.locator\\(${escaped}\\)`, 'g');
    const next = source.replace(locatorCall, `.${replacement.locator}`);
    if (next !== source) {
        changes.push({
            kind: 'locator',
            original: `.locator(${failedLocator})`,
            replacement: `.${replacement.locator}`,
            reason: replacement.reason,
        });
        return next;
    }
    return source;
}

export function applyWaitHealing(source: string, changes: HealingChange[]) {
    const waitRegex = /await\s+([a-zA-Z0-9_$.]+)\.waitForTimeout\(\s*\d+\s*\);?/g;
    let next = source.replace(waitRegex, (_match, pageRef: string) => {
        const replacement = `await ${pageRef}.waitForLoadState('domcontentloaded');`;
        changes.push({
            kind: 'wait',
            original: _match,
            replacement,
            reason: 'Replace hard timeout with Playwright load-state wait.',
        });
        return replacement;
    });
    next = next.replace(/timeout:\s*(\d{1,3})/g, (_match, timeoutValue: string) => {
        const replacement = 'timeout: 5000';
        changes.push({
            kind: 'wait',
            original: `timeout: ${timeoutValue}`,
            replacement,
            reason: 'Increase unrealistically short explicit timeout for Playwright auto-waiting.',
        });
        return replacement;
    });
    return next;
}

export function parseExpectedActual(output: string) {
    const clean = stripAnsi(output);
    const expected = clean.match(/Expected(?: string)?:\s*["'`](.+?)["'`]/i)?.[1];
    const actual = clean.match(/Received(?: string)?:\s*["'`](.+?)["'`]/i)?.[1];
    if (!expected || !actual) return undefined;
    return { expected, actual };
}

export function canHealAssertion(expected: string, actual: string) {
    if (expected.trim() === actual.trim()) return 'whitespace difference';
    if (expected.toLowerCase() === actual.toLowerCase()) return 'casing difference';
    const dynamicPattern = /\d{2,}|\d{4}-\d{2}-\d{2}|\$?\d+(?:\.\d{2})?/;
    if (dynamicPattern.test(expected) && dynamicPattern.test(actual)) return 'dynamic value pattern';
    return undefined;
}

export function applyAssertionHealing(source: string, output: string, changes: HealingChange[]) {
    const pair = parseExpectedActual(output);
    if (!pair) return source;
    const reason = canHealAssertion(pair.expected, pair.actual);
    if (!reason) return source;
    const escapedExpected = pair.expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactText = new RegExp(`toHaveText\\((['"\`])${escapedExpected}\\1\\)`, 'g');
    const replacement = reason === 'dynamic value pattern'
        ? `toHaveText(/${pair.actual.replace(/\d+/g, '\\d+').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\\d\+/g, '\\d+')}/i)`
        : `toHaveText(/${pair.expected.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i)`;
    const next = source.replace(exactText, replacement);
    if (next !== source) {
        changes.push({
            kind: 'assertion',
            original: `toHaveText('${pair.expected}')`,
            replacement,
            reason: `Allowed assertion healing: ${reason}.`,
        });
    }
    return next;
}

export function createHealedScript(params: {
    artifacts: RunArtifacts;
    sourceCode?: string;
    sourceFile?: string;
    classification: FailureClassification;
    output: string;
    failedLocator?: string;
    evidence: HealingEvidence;
    aiSuggestion?: AiHealingSuggestion;
}) {
    const rootDir = getProjectRoot();
    const automationDir = join(rootDir, 'automation');
    const changes: HealingChange[] = [];
    const source = params.sourceCode ?? (params.sourceFile && existsSync(params.sourceFile) ? readFileSync(params.sourceFile, 'utf-8') : '');
    if (!source.trim()) return { changes, healedScriptPath: undefined };

    let healed = applyAiSuggestion(source, params.aiSuggestion, changes);
    if (['LOCATOR_NOT_FOUND', 'ELEMENT_DETACHED', 'ELEMENT_HIDDEN'].includes(params.classification.type)) {
        healed = applyLocatorHealing(healed, params.failedLocator, changes);
    }
    if (['TIMING_ISSUE', 'WAIT_ISSUE', 'NAVIGATION_WAIT_ISSUE', 'ELEMENT_DETACHED', 'ELEMENT_HIDDEN'].includes(params.classification.type)) {
        healed = applyWaitHealing(healed, changes);
    }
    if (params.classification.type === 'TEXT_ASSERTION_MISMATCH') {
        healed = applyAssertionHealing(healed, params.output, changes);
    }

    const header = [
        '// Auto-healed by TCGen-Buddy.',
        `// Run ID: ${params.artifacts.runId}`,
        `// Failure Type: ${params.classification.type}`,
        '',
    ].join('\n');
    const sourceName = sanitizeFilePart(basename(params.sourceFile || 'generated.spec.ts').replace(/\.spec\.ts$/i, ''));
    const healedDir = join(automationDir, 'scripts', 'healed', params.artifacts.runId);
    const healedScriptPath = join(healedDir, `${sourceName}.healed.spec.ts`);
    mkdirSync(healedDir, { recursive: true });
    writeFileSync(healedScriptPath, `${header}${healed}`, 'utf-8');
    return { changes, healedScriptPath };
}

export function buildFailedOnlyGrep(titles: string[]) {
    const escaped = titles
        .map(title => title.trim())
        .filter(Boolean)
        .map(title => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return escaped[0];
}