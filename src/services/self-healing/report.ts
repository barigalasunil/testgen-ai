import { writeFileSync } from 'fs';
import type { RunArtifacts } from '../automation/types';
import type { HealingAttemptResult, HealingStatus } from './types';

export function healingStatusLabel(status: HealingStatus) {
    const labels: Record<HealingStatus, string> = {
        AUTO_HEALED: 'Auto-Healed',
        PARTIALLY_HEALED: 'Partially Healed',
        NEEDS_MANUAL_REVIEW: 'Needs Manual Review',
        NOT_HEALABLE: 'Not Healable',
    };
    return labels[status];
}

export function writeHealingReport(params: {
    artifacts: RunArtifacts;
    attempt: HealingAttemptResult;
}) {
    const attempt = params.attempt;
    const firstChange = attempt.changes[0];
    const report = [
        `# Healing Report - ${params.artifacts.runId}`,
        '',
        `Run ID: ${params.artifacts.runId}`,
        `Suite: ${attempt.evidence.suite}`,
        `Failed Test: ${attempt.evidence.testTitle}`,
        `Final Status: ${attempt.finalStatus}`,
        `Failure Type: ${attempt.classification.type}`,
        `Healable: ${attempt.classification.isHealable ? 'Yes' : 'No'}`,
        `Confidence: ${attempt.confidence.toFixed(2)}`,
        `Reason: ${attempt.reason}`,
        '',
        '## Failed Tests',
        ...(attempt.evidence.testTitles.length ? attempt.evidence.testTitles.map(test => `- ${test}`) : ['- Unknown failed test']),
        '',
        '## Evidence',
        `- Evidence JSON: ${attempt.evidence.evidenceJsonPath}`,
        `- Error Stack: ${attempt.evidence.errorStackPath}`,
        `- Screenshots: ${attempt.evidence.screenshots.join(', ') || 'Not captured'}`,
        `- Traces: ${attempt.evidence.traces.join(', ') || 'Not captured'}`,
        `- Videos: ${attempt.evidence.videos.join(', ') || 'Not captured'}`,
        `- Failed Locator: ${attempt.evidence.failedLocator || 'Not detected'}`,
        `- Current URL: ${attempt.evidence.currentUrl || 'Unknown'}`,
        `- Browser: ${attempt.evidence.browser}`,
        `- DOM Candidates: ${attempt.domCandidatesPath || 'Not collected'} (${attempt.domCandidateCount ?? 0})`,
        attempt.aiPromptPath ? `- AI Prompt: ${attempt.aiPromptPath}` : '- AI Prompt: Not used',
        '',
        '## Locator Healing',
        `- Original Locator: ${attempt.originalLocator || 'Not applicable'}`,
        `- Replacement Locator: ${attempt.replacementLocator || 'Not applicable'}`,
        '',
        '## Original Code',
        '```ts',
        firstChange?.original || 'Not applicable',
        '```',
        '',
        '## Healed Code',
        '```ts',
        firstChange?.replacement || 'Not applicable',
        '```',
        '',
        '## Code Changes',
        ...(attempt.changes.length
            ? attempt.changes.map(change => `- ${change.kind}: ${change.original} -> ${change.replacement} (${change.reason})`)
            : ['- No safe automatic code change was generated.']),
        '',
        '## Re-run Result',
        `- Failed-only grep: ${attempt.failedOnlyGrep || 'Not available'}`,
        `- Healed Script: ${attempt.healedScriptPath || 'Not created'}`,
        `- Re-run Status: ${attempt.rerunResult ? (attempt.rerunResult.success ? 'PASS' : 'FAIL') : 'Not run'}`,
        '',
        '## Manual Review Notes',
        attempt.finalStatus === 'NEEDS_MANUAL_REVIEW'
            ? '- Review the failed locator, DOM candidates, trace, and suggested patch before applying to source.'
            : '- No manual review notes.',
        attempt.error ? `- Error: ${attempt.error}` : '',
    ].filter(Boolean).join('\n');

    writeFileSync(params.artifacts.healingReportPath, report, 'utf-8');
}