import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const OLLAMA = 'http://127.0.0.1:11434';

async function getModel(requested?: string): Promise<string> {
    try {
        const res = await fetch(`${OLLAMA}/api/tags`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`Ollama API returned ${res.status}`);
        const data = await res.json() as { models: { name: string }[] };
        const names = data.models.map((m: { name: string }) => m.name);
        console.log('[API-TESTING] Available:', names);

        if (requested && names.includes(requested)) return requested;

        const order = ['qwen3', 'granite', 'phi3', 'mistral', 'gemma4', 'gemma3', 'stablelm'];
        for (const p of order) {
            const found = names.find((n: string) => n.startsWith(p));
            if (found) return found;
        }
        return names[0] || 'mistral:7b';
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Ollama not responding at ${OLLAMA}: ${msg}`);
    }
}

async function readSpec(swaggerUrl?: string, swaggerJson?: string): Promise<string> {
    if (swaggerUrl?.trim()) {
        const url = swaggerUrl.trim();
        if (url.startsWith('/')) {
            try {
                return readFileSync(join(process.cwd(), 'public', url), 'utf-8');
            } catch {
                throw new Error('File not found in public/: ' + url);
            }
        }
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error('Cannot fetch spec: HTTP ' + res.status);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('yaml') || (ct.includes('text') && !ct.includes('json'))) {
            return await res.text();
        }
        return JSON.stringify(await res.json(), null, 2);
    }
    if (swaggerJson?.trim()) return swaggerJson.trim();
    throw new Error('Provide a Swagger URL or paste the spec.');
}

function buildPrompt(spec: string, type: string): string {
    const s = spec.length > 4000 ? spec.slice(0, 4000) + '\n...(truncated)' : spec;

    if (type === 'restassured') {
        return 'You are a QA engineer. Generate RestAssured Java tests.\n\nAPI SPEC:\n' + s + '\n\nWrite a Java class called ApiTests with @Test methods using given().when().then() syntax and Hamcrest matchers. Cover happy path, invalid input, auth failure. Include all imports.\n\nReturn ONLY Java code.';
    }

    if (type === 'scenarios') {
        return 'You are a QA engineer. Generate API test scenarios.\n\nAPI SPEC:\n' + s + '\n\nWrite one scenario per line:\nTC-001 | METHOD /path | Scenario | Test Data | Expected Result\n\nReturn ONLY the scenario lines.';
    }

    return 'You are a QA engineer. Generate Playwright TypeScript API tests.\n\nAPI SPEC:\n' + s + '\n\nUse import { test, expect } from \'@playwright/test\'. Use request.newContext(). Return ONLY TypeScript code.';
}

export async function POST(req: Request) {
    console.log('[API-TESTING] POST received');

    try {
        const body = await req.json();
        const { swaggerUrl, swaggerJson, model, testType } = body;
        const type = testType || 'restassured';

        console.log('[API-TESTING] Input:', { url: swaggerUrl?.slice(0, 50), model, type });

        let selectedModel: string;
        try {
            selectedModel = await getModel(model);
            console.log('[API-TESTING] Model:', selectedModel);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[API-TESTING] Model error:', msg);
            return NextResponse.json({ success: false, error: 'Cannot reach Ollama: ' + msg }, { status: 503 });
        }

        let spec: string;
        try {
            spec = await readSpec(swaggerUrl, swaggerJson);
            console.log('[API-TESTING] Spec length:', spec.length);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return NextResponse.json({ success: false, error: msg }, { status: 400 });
        }

        const prompt = buildPrompt(spec, type);
        console.log('[API-TESTING] Calling Ollama...');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8 * 60 * 1000);

        let code: string;
        try {
            const ollamaRes = await fetch(OLLAMA + '/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt,
                    stream: false,
                    options: { num_predict: 3000, temperature: 0.2, top_p: 0.9 },
                }),
                signal: controller.signal,
            });

            console.log('[API-TESTING] Ollama status:', ollamaRes.status);

            if (!ollamaRes.ok) {
                const errText = await ollamaRes.text();
                throw new Error('Ollama ' + ollamaRes.status + ': ' + errText.slice(0, 200));
            }

            const ollamaData = await ollamaRes.json();
            code = ollamaData.response?.trim() || '';
            console.log('[API-TESTING] Response chars:', code.length);

            if (!code) throw new Error('Model returned empty response. Try again.');

        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const isAbort = msg.includes('abort') || msg.includes('signal') || msg.toLowerCase().includes('timeout');
            const isConnection = msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('127.0.0.1');
            console.error('[API-TESTING] Ollama error:', msg);
            
            if (isAbort) {
                return NextResponse.json({
                    success: false,
                    error: 'Model timed out. Run: ollama run qwen3:1.7b "hi" in terminal first, then retry.',
                }, { status: 503 });
            }
            
            if (isConnection) {
                return NextResponse.json({
                    success: false,
                    error: `Cannot connect to Ollama at ${OLLAMA}. Make sure Ollama is running: ollama serve`,
                }, { status: 503 });
            }
            
            return NextResponse.json({ success: false, error: msg }, { status: 503 });
        } finally {
            clearTimeout(timer);
        }

        console.log('[API-TESTING] Done');
        return NextResponse.json({ success: true, code, model: selectedModel, type });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[API-TESTING] Unexpected:', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}