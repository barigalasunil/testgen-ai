import { join, basename, relative } from 'path';
import { mkdirSync, copyFileSync, writeFileSync, existsSync } from 'fs';
import { stripAnsi } from './classifier';
import { PROJECT_BASE_URL, collectArtifactFiles, getProjectRoot, sanitizeFilePart } from '../automation/utils';
import type { BrowserName, PlaywrightRunResult, RunArtifacts } from '../automation/types';
import type { HealingEvidence } from './types';

export function copyEvidenceFiles(files: string[], evidenceDir: string) {
    const copied: string[] = [];
    mkdirSync(evidenceDir, { recursive: true });
    for (const file of files) {
        if (!existsSync(file)) continue;
        const destination = join(evidenceDir, `${copied.length + 1}-${sanitizeFilePart(basename(file))}`);
        try {
            copyFileSync(file, destination);
            copied.push(destination);
        } catch {}
    }
    return copied;
}

export function extractFailedTestTitles(result: PlaywrightRunResult, fallback: string[]) {
    const output = `${result.output || ''}\n${result.stderr || ''}`;
    const titles = new Set<string>(fallback.filter(Boolean));
    for (const line of output.split('\n')) {
        const failureList = line.match(/^\s*\d+\)\s+.*›\s+(.+)$/);
        if (failureList?.[1]) titles.add(failureList[1].trim());
        const bracketed = line.match(/\[[^\]]+\]\s+›\s+.*›\s+(.+)$/);
        if (bracketed?.[1] && /failed|error|timeout/i.test(output)) titles.add(bracketed[1].trim());
    }
    return [...titles]
        .map(title => title.replace(/\s+\(retry\s+#\d+\)/i, '').replace(/\s+\(\d+(?:\.\d+)?s\)$/, '').trim())
        .filter(Boolean)
        .filter((title, index, all) => all.indexOf(title) === index);
}

export function extractFailedLocator(output: string) {
    const locatorPatterns = [
        /locator\((['"`][^'"`\n]+['"`])\)/,
        /(getBy(?:Role|Label|Placeholder|Text|TestId)\([^)\n]+\))/,
        /waiting for ([^\n]+locator\([^)]+\))/i,
    ];
    for (const pattern of locatorPatterns) {
        const match = output.match(pattern);
        if (match?.[1]) return match[1].trim();
    }
    return undefined;
}

export function extractFailedLineNumber(output: string, sourceFile?: string) {
    const clean = stripAnsi(output);
    const normalizedSource = sourceFile ? sourceFile.replace(/\\/g, '/') : '';
    const fileName = sourceFile ? basename(sourceFile) : '';
    const patterns = [
        normalizedSource ? new RegExp(`${normalizedSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+):(\\d+)`) : undefined,
        fileName ? new RegExp(`${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+):(\\d+)`) : undefined,
        /at .*:(\d+):(\d+)/,
    ].filter(Boolean) as RegExp[];
    for (const pattern of patterns) {
        const match = clean.replace(/\\/g, '/').match(pattern);
        if (match?.[1]) return Number(match[1]);
    }
    return undefined;
}

export function extractErrorMessage(output: string) {
    const clean = stripAnsi(output).trim();
    const lines = clean.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return lines.find(line => /Error:|TimeoutError|expect\(|locator\(/i.test(line)) || lines[0] || 'Unknown Playwright failure';
}

export function extractCurrentUrl(output: string) {
    const clean = stripAnsi(output);
    return clean.match(/https?:\/\/[^\s"'<>),]+/i)?.[0]?.replace(/[.,;:]+$/, '') || PROJECT_BASE_URL;
}

export function collectHealingEvidence(params: {
    artifacts: RunArtifacts;
    result: PlaywrightRunResult;
    failedTests: string[];
    sourceFile?: string;
    browser: BrowserName;
    suite: string;
}) {
    const rootDir = getProjectRoot();
    const evidenceDir = join(params.artifacts.healingDir, 'evidence');
    const errorStackPath = join(params.artifacts.healingDir, 'error-stack.txt');
    const evidenceJsonFullPath = join(params.artifacts.healingDir, 'evidence.json');
    mkdirSync(params.artifacts.healingDir, { recursive: true });
    const stackTrace = `${params.result.output || ''}\n${params.result.stderr || ''}`.trim();
    writeFileSync(errorStackPath, stackTrace, 'utf-8');

    const searchRoots = [params.artifacts.tracesDir, params.artifacts.playwrightHtmlDir];
    const screenshots = copyEvidenceFiles(searchRoots.flatMap(dir => collectArtifactFiles(dir, ['.png'])).slice(0, 10), evidenceDir);
    const traces = copyEvidenceFiles(searchRoots.flatMap(dir => collectArtifactFiles(dir, ['.zip'])).slice(0, 10), evidenceDir);
    const videos = copyEvidenceFiles(searchRoots.flatMap(dir => collectArtifactFiles(dir, ['.webm'])).slice(0, 10), evidenceDir);
    const output = `${params.result.output || ''}\n${params.result.stderr || ''}`;
    const testTitles = extractFailedTestTitles(params.result, params.failedTests);
    const evidence: HealingEvidence = {
        testTitle: testTitles[0] || 'Unknown failed test',
        specFilePath: params.sourceFile ? relative(rootDir, params.sourceFile) : undefined,
        failedLineNumber: extractFailedLineNumber(output, params.sourceFile),
        errorMessage: extractErrorMessage(output),
        stackTrace,
        screenshotPath: screenshots[0] ? relative(rootDir, screenshots[0]) : undefined,
        tracePath: traces[0] ? relative(rootDir, traces[0]) : undefined,
        videoPath: videos[0] ? relative(rootDir, videos[0]) : undefined,
        currentUrl: extractCurrentUrl(output),
        browser: params.browser,
        suite: params.suite,
        runId: params.artifacts.runId,
        screenshots: screenshots.map(file => relative(rootDir, file)),
        traces: traces.map(file => relative(rootDir, file)),
        videos: videos.map(file => relative(rootDir, file)),
        errorStackPath: relative(rootDir, errorStackPath),
        evidenceJsonPath: relative(rootDir, evidenceJsonFullPath),
        testTitles,
        failedLocator: extractFailedLocator(output),
    };
    writeFileSync(evidenceJsonFullPath, JSON.stringify(evidence, null, 2), 'utf-8');
    return evidence;
}