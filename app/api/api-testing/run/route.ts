import { NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

export async function POST(request: Request) {
    try {
        const rawText = await request.text();
        let body: any;
        try { body = JSON.parse(rawText); }
        catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

        const { code, testType } = body;

        if (!code?.trim()) {
            return NextResponse.json({ success: false, error: 'No test code provided' }, { status: 400 });
        }

        if (testType === 'restassured') {
            return NextResponse.json({
                success: false,
                canRun: false,
                error: 'RestAssured (Java) tests require Maven/Gradle to run.\n\nTo run locally:\n1. Download the .java file\n2. Add RestAssured dependency to pom.xml\n3. Run: mvn test\n\nThe generated code has been saved to Jira for your team.',
            }, { status: 200 });
        }

        if (testType === 'scenarios' || testType === 'manual') {
            return NextResponse.json({
                success: false,
                canRun: false,
                error: 'Test scenarios and manual test cases are for human execution.\n\nUse these as a testing guide or import them into your test management tool.',
            }, { status: 200 });
        }

        if (testType !== 'playwright') {
            return NextResponse.json({
                success: false,
                canRun: false,
                error: 'Direct execution is only supported for Playwright TypeScript tests.',
            }, { status: 200 });
        }

        const rootDir = process.cwd();
        const tempDir = join(rootDir, 'automation', 'generated');
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

        const fileName = `api-test-${Date.now()}.spec.ts`;
        const filePath = join(tempDir, fileName);
        writeFileSync(filePath, code, 'utf-8');

        const configPath = join(rootDir, 'automation', 'playwright.config.ts');
        const reportDir = join(rootDir, 'public', 'automation-reports', 'api-tests');
        if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });

        return new Promise<NextResponse>((resolve) => {
            const child = spawn('npx', ['playwright', 'test', filePath, '--config', configPath, '--reporter=json'], {
                cwd: join(rootDir, 'automation'),
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, PW_REPORT_DIR: reportDir, PW_HEADED: 'false' },
            });

            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (d) => { stdout += d.toString(); });
            child.stderr?.on('data', (d) => { stderr += d.toString(); });

            const timeout = setTimeout(() => { child.kill(); }, 5 * 60 * 1000);

            child.on('close', (exitCode) => {
                clearTimeout(timeout);
                try { unlinkSync(filePath); } catch { }

                let results: any[] = [];
                let passed = 0; let failed = 0;
                try {
                    const match = stdout.match(/\{[\s\S]*"suites"[\s\S]*\}/);
                    if (match) {
                        const report = JSON.parse(match[0]);
                        const specs = report.suites?.[0]?.specs || [];
                        results = specs.map((t: any) => ({
                            title: t.title,
                            status: t.tests?.[0]?.results?.[0]?.status || 'unknown',
                            duration: t.tests?.[0]?.results?.[0]?.duration || 0,
                            error: t.tests?.[0]?.results?.[0]?.error?.message || null,
                        }));
                        passed = results.filter(r => r.status === 'passed').length;
                        failed = results.filter(r => r.status !== 'passed').length;
                    }
                } catch { }

                resolve(NextResponse.json({
                    success: exitCode === 0,
                    passed, failed,
                    total: results.length,
                    results,
                    output: stdout.slice(0, 3000),
                    reportUrl: '/automation-reports/api-tests/index.html',
                }));
            });
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
