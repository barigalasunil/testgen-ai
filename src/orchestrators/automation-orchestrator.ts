export type AutomationTarget = 'web' | 'api';

export interface AutomationRequest {
    testCases: { title: string; steps: string; expectedResult: string }[];
    target: AutomationTarget;
    jiraStoryId?: string;
    headed: boolean;
}

export interface AutomationResult {
    scriptFile: string;
    success: boolean;
    reportUrl?: string;
    durationMs: number;
    passed: number;
    failed: number;
}

export function shouldShowPlaywright(platformType: string): boolean {
    return platformType === 'web';
}

export function getAutomationLabel(target: AutomationTarget): string {
    return target === 'web' ? 'Playwright (Browser)' : 'Playwright APIRequestContext';
}
