import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const VALID_SUITES = ['smoke', 'sanity', 'regression'] as const;
type SuiteName = (typeof VALID_SUITES)[number];

function getReportUrl(suite: SuiteName) {
  return `/automation-reports/${suite}/index.html`;
}

function getProjectRoot(): string {
  // In Next.js, we need to find the actual project root
  // This resolves from the built app location back to the project root
  let root = process.cwd();
  
  // If we're in .next or dist, go back to project root
  if (root.includes('.next') || root.includes('dist')) {
    root = root.split('.next')[0].split('dist')[0];
  }
  
  console.log('[AUTOMATION] Project root:', root);
  return root;
}

async function runPlaywrightSuite(suite: SuiteName) {
  const rootDir = getProjectRoot();
  const reportDir = join(rootDir, 'public', 'automation-reports', suite);
  const testPath = join(rootDir, 'automation', 'tests', suite);
  const configPath = join(rootDir, 'automation', 'playwright.config.ts');
  
  console.log('[AUTOMATION] Suite:', suite);
  console.log('[AUTOMATION] Working directory:', rootDir);
  console.log('[AUTOMATION] Test path:', testPath);
  console.log('[AUTOMATION] Config path:', configPath);
  console.log('[AUTOMATION] Report directory:', reportDir);

  // Ensure report directory exists
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
    console.log('[AUTOMATION] Created report directory:', reportDir);
  }

  // Build command with proper arguments (reporter configured in playwright.config.ts)
  const args = [
    'playwright',
    'test',
    testPath,
    '--config',
    configPath,
  ];

  console.log('[AUTOMATION] Running command: npx', args.join(' '));
  console.log('[AUTOMATION] Report directory env: PW_REPORT_DIR =', reportDir);

  return new Promise<{ success: boolean; output: string; durationMs: number; stderr?: string }>((resolvePromise, reject) => {
    const start = Date.now();
    
    // Use shell on Windows, don't use it on other platforms
    const isWindows = process.platform === 'win32';
    
    const child = spawn('npx', args, {
      cwd: rootDir,
      shell: isWindows,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SAUCEDEMO_BASE_URL: 'https://www.saucedemo.com',
        PW_REPORT_DIR: reportDir,
      },
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        console.log('[AUTOMATION STDOUT]', text);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        console.error('[AUTOMATION STDERR]', text);
      });
    }

    child.on('error', (error) => {
      const durationMs = Date.now() - start;
      console.error('[AUTOMATION ERROR]', error.message);
      reject({ error, durationMs, stdout, stderr });
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - start;
      console.log('[AUTOMATION] Process closed with code:', code, 'Duration:', durationMs, 'ms');
      resolvePromise({ 
        success: code === 0, 
        output: stdout, 
        durationMs,
        stderr,
      });
    });

    // Set a timeout to kill the process if it takes too long (30 minutes)
    const timeoutHandle = setTimeout(() => {
      console.error('[AUTOMATION] Test execution timeout - killing process');
      child.kill();
    }, 30 * 60 * 1000);

    child.on('close', () => {
      clearTimeout(timeoutHandle);
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const suite = body?.suite as string;

    console.log('[AUTOMATION API] Request received for suite:', suite);

    if (!VALID_SUITES.includes(suite as SuiteName)) {
      console.warn('[AUTOMATION API] Invalid suite name:', suite);
      return NextResponse.json(
        { 
          error: true, 
          message: 'Invalid suite name. Expected smoke, sanity, or regression.' 
        },
        { status: 400 }
      );
    }

    const startedAt = new Date().toISOString();
    const reportUrl = getReportUrl(suite as SuiteName);
    
    console.log('[AUTOMATION API] Starting execution for suite:', suite);
    const result = await runPlaywrightSuite(suite as SuiteName);

    if (!result.success) {
      console.error('[AUTOMATION API] Suite execution failed:', suite);
      console.error('[AUTOMATION API] Output:', result.output);
      console.error('[AUTOMATION API] Stderr:', result.stderr);
      
      return NextResponse.json(
        {
          error: true,
          suite,
          status: 'failed',
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: result.durationMs,
          reportUrl,
          message: 'Test execution failed. Check browser console for details.',
          output: result.output,
          stderr: result.stderr,
        },
        { status: 500 }
      );
    }

    console.log('[AUTOMATION API] Suite execution succeeded:', suite, 'Duration:', result.durationMs, 'ms');
    return NextResponse.json({
      error: false,
      suite,
      status: 'completed',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: result.durationMs,
      reportUrl,
      message: 'Execution succeeded.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[AUTOMATION API] Catch block error:', errorMessage, error);
    return NextResponse.json(
      { 
        error: true, 
        message: `Automation execution failed: ${errorMessage}` 
      },
      { status: 500 }
    );
  }
}
