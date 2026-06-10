import { NextResponse } from 'next/server';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

function runCommand(command: string, args: string[], cwd: string, timeoutMs: number, env: Record<string, string> = {}): Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
    durationMs: number;
}> {
    const startedAt = Date.now();
    return new Promise(resolve => {
        const child = spawn(command, args, {
            cwd,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PW_HEADED: 'false', ...env },
        });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
        child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
        const timeout = setTimeout(() => child.kill(), timeoutMs);
        child.on('close', exitCode => {
            clearTimeout(timeout);
            resolve({ exitCode, stdout, stderr, durationMs: Date.now() - startedAt });
        });
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as { code?: string; testType?: string };
        const code = body.code || '';
        const testType = body.testType || 'playwright';

        if (!code.trim()) {
            return NextResponse.json({ success: false, error: 'No API automation code provided' }, { status: 400 });
        }

        const rootDir = process.cwd();
        const tempDir = join(rootDir, 'automation', 'tests', 'generated');
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

        if (testType === 'restassured') {
            return NextResponse.json({
                success: false,
                canRun: false,
                passed: 0,
                failed: 0,
                total: 0,
                error: 'Rest Assured execution requires a Maven/TestNG project and Java runtime. Generate the framework files, add them to a Maven project, then run: mvn test',
                output: 'Rest Assured command: mvn test',
            }, { status: 501 });
        }

        if (testType === 'newman') {
            const filePath = join(tempDir, `newman-${Date.now()}.json`);
            writeFileSync(filePath, code, 'utf-8');
            const result = await runCommand('npx', ['newman', 'run', filePath], rootDir, 180000);
            try { unlinkSync(filePath); } catch {}
            const notInstalled = /could not determine executable|not recognized|newman/i.test(result.stderr) && result.exitCode !== 0;
            return NextResponse.json({
                success: result.exitCode === 0,
                passed: result.exitCode === 0 ? 1 : 0,
                failed: result.exitCode === 0 ? 0 : 1,
                total: 1,
                durationMs: result.durationMs,
                error: notInstalled ? 'Newman not installed. Install with: npm install -D newman' : undefined,
                output: result.stdout.slice(0, 5000),
                stderr: result.stderr.slice(0, 5000),
            }, { status: result.exitCode === 0 ? 200 : notInstalled ? 501 : 500 });
        }

        if (testType !== 'playwright') {
            return NextResponse.json({ success: false, error: `Unsupported API execution framework: ${testType}` }, { status: 400 });
        }

        const fileName = `api-test-${Date.now()}.spec.ts`;
        const filePath = join(tempDir, fileName);
        const relativeSpecPath = `tests/generated/${fileName}`;
        writeFileSync(filePath, code, 'utf-8');
        const configPath = join(rootDir, 'automation', 'playwright.config.ts');
        const reportName = `run-${Date.now()}`;
        const reportDir = join(rootDir, 'public', 'automation-reports', 'api-tests', reportName);
        if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
        const result = await runCommand(
            'npx',
            ['playwright', 'test', relativeSpecPath, '--config', configPath, '--reporter=json,html'],
            join(rootDir, 'automation'),
            300000,
            { PW_REPORT_DIR: reportDir, PLAYWRIGHT_HTML_REPORT: reportDir }
        );
        try { unlinkSync(filePath); } catch {}

        let passed = 0;
        let failed = result.exitCode === 0 ? 0 : 1;
        let total = result.exitCode === 0 ? 1 : 1;
        const collectSpecs = (suite: { specs?: unknown[]; suites?: unknown[] }): unknown[] => [
            ...(Array.isArray(suite.specs) ? suite.specs : []),
            ...(Array.isArray(suite.suites) ? suite.suites.flatMap(child => collectSpecs(child as { specs?: unknown[]; suites?: unknown[] })) : []),
        ];
        try {
            const match = result.stdout.match(/\{[\s\S]*"suites"[\s\S]*\}/);
            if (match) {
                const report = JSON.parse(match[0]);
                const specs = Array.isArray(report.suites)
                    ? report.suites.flatMap((suite: { specs?: unknown[]; suites?: unknown[] }) => collectSpecs(suite))
                    : [];
                total = specs.length || total;
                passed = specs.filter((spec: { tests?: { results?: { status?: string }[] }[] }) => spec.tests?.[0]?.results?.[0]?.status === 'passed').length;
                failed = Math.max(total - passed, 0);
            }
        } catch {}
        const reportIndex = join(reportDir, 'index.html');
        const reportUrl = existsSync(reportIndex)
            ? `/automation-reports/api-tests/${reportName}/index.html`
            : undefined;

        return NextResponse.json({
            success: result.exitCode === 0,
            passed,
            failed,
            total,
            durationMs: result.durationMs,
            output: result.stdout.slice(0, 5000),
            stderr: result.stderr.slice(0, 5000),
            reportUrl,
        }, { status: result.exitCode === 0 ? 200 : 500 });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
