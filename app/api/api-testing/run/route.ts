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
        const body = await request.json() as { code?: string; testType?: string; expectedCount?: number };
        const code = body.code || '';
        const testType = body.testType || 'playwright';
        const expectedCount = body.expectedCount || 0;

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
                error: 'Rest Assured execution requires a Maven/TestNG project. Use: mvn test',
                output: 'Rest Assured command: mvn test',
            }, { status: 501 });
        }

        if (testType === 'newman') {
            const filePath = join(tempDir, `newman-${Date.now()}.json`);
            writeFileSync(filePath, code, 'utf-8');
            const result = await runCommand('npx', ['newman', 'run', filePath], rootDir, 180000);
            try { unlinkSync(filePath); } catch {}
            
            // Basic Newman parsing
            const assertionsMatch = result.stdout.match(/assertions\s+│\s+(\d+)\s+│\s+(\d+)/);
            const total = assertionsMatch ? parseInt(assertionsMatch[1]) : (result.exitCode === 0 ? 1 : 1);
            const failed = assertionsMatch ? parseInt(assertionsMatch[2]) : (result.exitCode === 0 ? 0 : 1);
            const passed = total - failed;

            return NextResponse.json({
                success: result.exitCode === 0,
                passed,
                failed,
                total,
                durationMs: result.durationMs,
                output: result.stdout.slice(0, 5000),
                stderr: result.stderr.slice(0, 5000),
            });
        }

        if (testType !== 'playwright') {
            return NextResponse.json({ success: false, error: `Unsupported framework: ${testType}` }, { status: 400 });
        }

        const fileName = `api-test-${Date.now()}.spec.ts`;
        const filePath = join(tempDir, fileName);
        const relativeSpecPath = `tests/generated/${fileName}`;
        writeFileSync(filePath, code, 'utf-8');
        const configPath = join(rootDir, 'automation', 'playwright.config.ts');
        
        const result = await runCommand(
            'npx',
            ['playwright', 'test', relativeSpecPath, '--config', configPath, '--reporter=json'],
            join(rootDir, 'automation'),
            300000
        );
        try { unlinkSync(filePath); } catch {}

        let passed = 0;
        let failed = 0;
        let total = 0;

        try {
            const report = JSON.parse(result.stdout);
            const stats = report.stats || {};
            total = stats.expected || 0;
            passed = stats.unexpected === 0 ? total : (stats.expected - stats.unexpected);
            failed = stats.unexpected || 0;

            // Strict Validation
            if (expectedCount > 0 && total !== expectedCount) {
                console.warn(`[Execution] Count mismatch: Expected ${expectedCount}, ran ${total}`);
            }
        } catch {
            total = result.exitCode === 0 ? 1 : 1;
            passed = result.exitCode === 0 ? 1 : 0;
            failed = total - passed;
        }

        return NextResponse.json({
            success: result.exitCode === 0,
            passed,
            failed,
            total,
            durationMs: result.durationMs,
            output: result.stdout.slice(0, 5000),
            stderr: result.stderr.slice(0, 5000),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
