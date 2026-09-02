import type { BrowserName, PlaywrightRunResult } from '../automation/types';

export const SITE_NAVIGATION_TIMEOUT = 'SITE_NAVIGATION_TIMEOUT';

export type HealingCategory = 'HEALABLE' | 'NOT_HEALABLE' | 'UNKNOWN';
export type FailureType =
    | 'LOCATOR_NOT_FOUND'
    | 'ELEMENT_DETACHED'
    | 'ELEMENT_HIDDEN'
    | 'TIMING_ISSUE'
    | 'WAIT_ISSUE'
    | 'TEXT_ASSERTION_MISMATCH'
    | 'NAVIGATION_WAIT_ISSUE'
    | 'SITE_DOWN'
    | 'DNS_FAILURE'
    | 'SSL_FAILURE'
    | 'HTTP_5XX'
    | 'AUTHENTICATION_FAILURE'
    | 'INVALID_TEST_DATA'
    | 'BUSINESS_LOGIC_FAILURE'
    | 'UNKNOWN';

export type FailureClassification = {
    type: FailureType;
    failureType: FailureType;
    category: HealingCategory;
    isHealable: boolean;
    confidence: number;
    rootCause: string;
    reason: string;
};

export type HealingChange = {
    kind: 'locator' | 'wait' | 'assertion';
    original: string;
    replacement: string;
    reason: string;
};

export type HealingEvidence = {
    testTitle: string;
    specFilePath?: string;
    failedLineNumber?: number;
    errorMessage: string;
    stackTrace: string;
    screenshotPath?: string;
    tracePath?: string;
    videoPath?: string;
    currentUrl?: string;
    browser: BrowserName;
    suite: string;
    runId: string;
    screenshots: string[];
    traces: string[];
    videos: string[];
    errorStackPath: string;
    evidenceJsonPath: string;
    testTitles: string[];
    failedLocator?: string;
};

export type DomCandidates = {
    url?: string;
    buttons: string[];
    inputs: string[];
    labels: string[];
    placeholders: string[];
    links: string[];
    headings: string[];
    ariaLabels: string[];
    testIds: string[];
    textCandidates: string[];
};

export type AiHealingSuggestion = {
    canHeal: boolean;
    healingType: 'locator' | 'wait' | 'assertion';
    originalCode: string;
    healedCode: string;
    reason: string;
    confidence: number;
};

export type HealingStatus = 'AUTO_HEALED' | 'PARTIALLY_HEALED' | 'NEEDS_MANUAL_REVIEW' | 'NOT_HEALABLE';
export type HealingAttemptResult = {
    attempted: boolean;
    finalStatus: HealingStatus;
    classification: FailureClassification;
    evidence: HealingEvidence;
    healedScriptPath?: string;
    failedOnlyGrep?: string;
    changes: HealingChange[];
    rerunResult?: PlaywrightRunResult;
    originalLocator?: string;
    replacementLocator?: string;
    confidence: number;
    reason: string;
    domCandidatesPath?: string;
    domCandidateCount?: number;
    aiSuggestion?: AiHealingSuggestion;
    aiPromptPath?: string;
    memoryVaultEvent?: {
        sourceType: 'self_healing_event';
        runId: string;
        suite: string;
        testTitle: string;
        failureType: FailureType;
        originalLocator?: string;
        healedLocator?: string;
        finalStatus: HealingStatus;
        confidence: number;
        linkedAutomationRunId: string;
        linkedStoryId?: string;
        healedScriptPath?: string;
        createdAt: string;
    };
    error?: string;
};