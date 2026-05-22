import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const VALID_SUITES = ['smoke', 'sanity', 'regression'] as const;
type SuiteName = (typeof VALID_SUITES)[number];

function getReportUrl(suite: SuiteName) {
  return `/automation-reports/${suite}/index.html`;
}

async function runPlaywrightSuite(suite: SuiteName) {
  const rootDir = process.cwd();
  const reportPath = resolve(rootDir, 'public', 'automation-reports', suite);
  const args = [
    'playwright',
    'test',
    `automation/tests/${suite}`,
    '--config',
    'automation/playwright.config.ts',
    `--reporter=html=${reportPath}`,
  ];

  return new Promise<{ success: boolean; output: string; durationMs: number }>((resolvePromise, reject) => {
    const start = Date.now();
    const child = spawn('npx', args, {
      cwd: rootDir,
      shell: true,
      env: process.env,
    });

    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - start;
      resolvePromise({ success: code === 0, output, durationMs });
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const suite = body?.suite as string;

    if (!VALID_SUITES.includes(suite as SuiteName)) {
      return NextResponse.json(
        { error: true, message: 'Invalid suite name. Expected smoke, sanity, or regression.' },
        { status: 400 }
      );
    }

    const startedAt = new Date().toISOString();
    const reportUrl = getReportUrl(suite as SuiteName);
    const result = await runPlaywrightSuite(suite as SuiteName);

    if (!result.success) {
      return NextResponse.json(
        {
          error: true,
          suite,
          status: 'failed',
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: result.durationMs,
          reportUrl,
          output: result.output,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      error: false,
      suite,
      status: 'completed',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: result.durationMs,
      reportUrl,
      output: result.output,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: true, message: `Automation execution failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
