import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const OLLAMA_BASE = 'http://127.0.0.1:11434';

async function getFirstAvailableModel(preferred?: string): Promise<string> {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
        signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as { models: { name: string }[] };
    const names = data.models.map(m => m.name);
    console.log('[API-TESTING] All models:', names);

    if (preferred && names.includes(preferred)) return preferred;

    const order = ['qwen3', 'granite', 'phi3', 'mistral', 'gemma4', 'gemma3', 'stablelm'];
    for (const pref of order) {
        const found = names.find(n => n.startsWith(pref));
        if (found) return found;
    }
    return names[0];
}

async function readSpec(swaggerUrl?: string, swaggerJson?: string): Promise<string> {
    if (swaggerUrl?.trim()) {
        const url = swaggerUrl.trim();
        if (url.startsWith('/')) {
            try {
                return readFileSync(join(process.cwd(), 'public', url), 'utf-8');
            } catch {
                throw new Error(`File not found in public/: ${url}`);
            }
        }
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`Cannot fetch spec: HTTP ${res.status}`);
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

    if (type === 'restassured') return `You are a QA engineer. Generate RestAssured Java tests.

API SPEC:
${s}

Requirements:
- Class name: ApiTests
- @Test on each method
- given().when().then() syntax
- Hamcrest matchers
- Cover happy path, invalid input, auth failure
- Include all imports

Return ONLY Java code.`;

    if (type === 'scenarios') return `You are a QA engineer. Generate API test scenarios.

API SPEC:
${s}

Format each line as:
TC-001 | METHOD /path | Scenario | Test Data | Expected Result

Return ONLY the table rows.`;

    return `You are a QA engineer. Generate Playwright TypeScript API tests.

API SPEC:
${s}

Use import { test, expect } from '@playwright/test'
Use request.newContext() for HTTP calls.
Return ONLY TypeScript code.`;
}

export async function POST(request: Request) {
    try {
        const { swaggerUrl, swaggerJson, model, testType } = await request.json();
        const type = testType || 'restassured';

        console.log('[API-TESTING] Request received:', { swaggerUrl, model, type });

        // Get model
        let selectedModel: string;
        try {
            selectedModel = await getFirstAvailableModel(model);
            console.log('[API-TESTING] Using model:', selectedModel);
        } catch (e) {
            return NextResponse.json({
                success: false,
                error: `Cannot connect to Ollama at ${OLLAMA_BASE}. Is it running?`
            }, { status: 503 });
        }

        // Read spec
        let spec: string;
        try {
            spec = await readSpec(swaggerUrl, swaggerJson);
            console.log('[API-TESTING] Spec length:', spec.length);
        } catch (e) {
            return NextResponse.json({
                success: false,
                error: e instanceof Error ? e.message : String(e)
            }, { status: 400 });
        }

        // Call Ollama — 8 minute timeout
        const prompt = buildPrompt(spec, type);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8 * 60 * 1000);

        let code: string;
        try {
            console.log('[API-TESTING] Calling Ollama...');
            const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt,
                    stream: false,
                    options: { num_predict: 3000, temperature: 0.2 },
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Ollama error ${res.status}: ${text}`);
            }

            const ollamaData = await res.json();
            code = ollamaData.response?.trim() || '';
            console.log('[API-TESTING] Response length:', code.length);

            if (!code) throw new Error('Model returned empty response. Try again.');

        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('abort') || msg.includes('timeout')) {
                return NextResponse.json({
                    success: false,
                    error: `Model timed out loading. Run this in terminal first:\n\nollama run qwen3:1.7b "hi"\n\nThen try again immediately.`
                }, { status: 503 });
            }
            return NextResponse.json({ success: false, error: msg }, { status: 503 });
        } finally {
            clearTimeout(timer);
        }

        return NextResponse.json({ success: true, code, model: selectedModel, type });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[API-TESTING ERROR]', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}