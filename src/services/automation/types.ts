export const VALID_SUITES = ['smoke', 'sanity', 'regression'] as const;
export type SuiteName = (typeof VALID_SUITES)[number];
export type BrowserName = 'chromium' | 'firefox' | 'webkit' | 'all';

export type PlaywrightRunResult = {
    success: boolean;
    output: string;
    durationMs: number;
    stderr?: string;
};

export type RunArtifacts = {
    runId: string;
    playwrightHtmlDir: string;
    allureResultsDir: string;
    allureReportDir: string;
    publicRunDir: string;
    playwrightReportUrl: string;
    allureReportUrl: string;
    healingDir: string;
    healingReportPath: string;
    healingReportUrl: string;
    logsDir: string;
    logPath: string;
    screenshotsDir: string;
    tracesDir: string;
};