import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const OLLAMA = 'http://127.0.0.1:11434';

// ── OpenRouter ──────────────────────────────────────────────────────────────
async function callOpenRouter(prompt: string): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set in .env.local');

    const model = process.env.OPENROUTER_MODEL || 'openrouter/auto';
    console.log('[API-TESTING] OpenRouter model:', model);

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'TCGen-Buddy',
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4000,
            temperature: 0.2,
        }),
        signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${err}`);
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    console.log('[API-TESTING] OpenRouter response length:', content.length);
    return content;
}

// ── Ollama ───────────────────────────────────────────────────────────────────
async function callOllama(prompt: string, model: string): Promise<string> {
    console.log('[API-TESTING] Ollama model:', model);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8 * 60 * 1000);

    try {
        const res = await fetch(`${OLLAMA}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false,
                options: { num_predict: 3000, temperature: 0.2, top_p: 0.9 },
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Ollama ${res.status}: ${text}`);
        }

        const data = await res.json();
        const response = data.response?.trim() || '';
        console.log('[API-TESTING] Ollama response length:', response.length);
        return response;
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isTimeout = msg.includes('abort') || msg.toLowerCase().includes('timeout');
        if (isTimeout) {
            throw new Error(
                'Ollama model timed out. Run in terminal: ollama run qwen3:1.7b "hi" then retry.'
            );
        }
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

// ── Smart AI caller — OpenRouter first, Ollama fallback ───────────────────
async function callAI(prompt: string, ollamaModel: string): Promise<string> {
    if (process.env.OPENROUTER_API_KEY) {
        try {
            return await callOpenRouter(prompt);
        } catch (e) {
            console.warn('[API-TESTING] OpenRouter failed, falling back to Ollama:', e);
            return await callOllama(prompt, ollamaModel);
        }
    }
    return await callOllama(prompt, ollamaModel);
}

// ── Get best available Ollama model ──────────────────────────────────────────
async function getOllamaModel(requested?: string): Promise<string> {
    try {
        const res = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json() as { models: { name: string }[] };
        const names = data.models.map((m: { name: string }) => m.name);
        console.log('[API-TESTING] Ollama models:', names);

        if (requested && names.includes(requested)) return requested;

        const order = ['qwen3', 'granite', 'phi3', 'mistral', 'gemma4', 'gemma3', 'stablelm'];
        for (const p of order) {
            const found = names.find((n: string) => n.startsWith(p));
            if (found) return found;
        }
        return names[0] || 'mistral:7b';
    } catch {
        return requested || 'mistral:7b';
    }
}

// ── Read spec from URL or paste ───────────────────────────────────────────────
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

// ── Chunk large specs so nothing gets truncated ───────────────────────────────
function buildPrompts(spec: string, type: string): string[] {
    const MAX = 3000;

    if (spec.length <= MAX) {
        return [singlePrompt(spec, type)];
    }

    // Split on endpoint boundaries for cleaner chunks
    const lines = spec.split('\n');
    const chunks: string[][] = [];
    let current: string[] = [];
    let size = 0;

    for (const line of lines) {
        if (size + line.length > MAX && current.length > 0) {
            chunks.push(current);
            current = [];
            size = 0;
        }
        current.push(line);
        size += line.length;
    }
    if (current.length > 0) chunks.push(current);

    return chunks.map((chunk, i) =>
        singlePrompt(chunk.join('\n'), type, i + 1, chunks.length)
    );
}

function singlePrompt(spec: string, type: string, part?: number, total?: number): string {
    const partNote = part && total && total > 1
        ? `\n\nNote: This is Part ${part} of ${total}. Generate tests for the endpoints in this section only.`
        : '';

    if (type === 'restassured') {
        return `You are a senior QA automation engineer. Generate comprehensive RestAssured Java tests for this API specification.${partNote}

API SPEC:
${spec}

Requirements:
- Class name: ApiTests${part ?? ''}
- @Test annotation on every method
- given().when().then() RestAssured syntax
- Hamcrest matchers (equalTo, notNullValue, hasSize, containsString)
- Cover every endpoint with: happy path, invalid input, missing auth, wrong data type, boundary values
- Add a // comment before each test explaining what it validates
- Include baseURI setup in @BeforeClass
- Include all required imports at the top

Return ONLY Java code. No markdown. No explanation outside the code.`;
    }

    if (type === 'scenarios') {
        return `You are a senior QA engineer. Generate comprehensive API test scenarios for this specification.${partNote}

API SPEC:
${spec}

Write one scenario per line in this exact format:
TC-001 | METHOD /path | Scenario title | Test data | Expected result

Cover ALL of these for each endpoint:
- Valid request — all required fields present
- Missing required fields — expect 400
- Invalid data types — expect 400
- No auth token — expect 401
- Resource not found — expect 404
- Boundary values — empty string, max length, negative numbers

Return ONLY the scenario lines. No headers. No markdown. No explanation.`;
    }

    if (type === 'manual') {
        return `You are a senior QA engineer. Generate industry-standard manual API test cases based on this specification.${partNote}

API SPEC:
${spec}

Generate a clear, professional table with the following columns ONLY:
| Test Case ID | Test Case Title | Preconditions | Test Steps | Expected Result | Priority | Status |

For each endpoint, include at minimum:
- 1 Happy Path
- 1 Negative Path (e.g. invalid input, missing field)
- 1 Security/Auth Path (e.g. missing token)

Return ONLY the markdown table. No explanation. No surrounding text.`;
    }

    if (type === 'newman') {
        return `You are a senior QA engineer. Generate a valid Postman Collection (v2.1.0) JSON for this API specification to be run via Newman CLI.${partNote}

API SPEC:
${spec}

Requirements:
- Valid JSON format ONLY. Do not use Markdown backticks.
- Include "info", "item", "event", and "variable" blocks.
- Create an item for each endpoint.
- For each item, include Postman tests in the "event" array to check status code (e.g., pm.response.to.have.status(200)) and response schema.

Return ONLY raw JSON text. No explanations.`;
    }

    return `You are a senior QA automation engineer. Generate comprehensive Playwright TypeScript API tests.${partNote}

API SPEC:
${spec}

Requirements:
- import { test, expect } from '@playwright/test'
- Use request.newContext() for all HTTP calls
- Group by endpoint using test.describe()
- Validate: status codes, response body fields, error messages, headers
- Cover: valid requests, invalid input, missing auth, not found, boundary values

Return ONLY TypeScript code. No markdown. No explanation outside the code.`;
}

// ── Main POST handler ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
    console.log('[API-TESTING] POST received');

    try {
        // Safe JSON parsing
        const rawText = await req.text();
        console.log('[API-TESTING] Raw body:', rawText.slice(0, 200));

        let body: any;
        try {
            body = JSON.parse(rawText);
        } catch {
            return NextResponse.json({
                success: false,
                error: 'Invalid JSON in request body',
            }, { status: 400 });
        }

        const { swaggerUrl, swaggerJson, model, testType } = body;
        const type = testType || 'restassured';

        console.log('[API-TESTING] Input:', {
            url: swaggerUrl?.slice(0, 50),
            model,
            type,
            openRouterEnabled: !!process.env.OPENROUTER_API_KEY,
        });

        // Read spec
        let spec: string;
        try {
            spec = await readSpec(swaggerUrl, swaggerJson);
            console.log('[API-TESTING] Spec length:', spec.length);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return NextResponse.json({ success: false, error: msg }, { status: 400 });
        }

        // Resolve Ollama model (used as fallback even with OpenRouter)
        const ollamaModel = await getOllamaModel(model);

        // Build chunked prompts
        const prompts = buildPrompts(spec, type);
        console.log('[API-TESTING] Prompt chunks:', prompts.length);

        // Generate each chunk
        const results: string[] = [];
        for (let i = 0; i < prompts.length; i++) {
            console.log(`[API-TESTING] Generating chunk ${i + 1}/${prompts.length}`);
            try {
                const code = await callAI(prompts[i], ollamaModel);
                if (code.trim()) results.push(code);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error(`[API-TESTING] Chunk ${i + 1} error:`, msg);
                // Continue — don't fail everything if one chunk fails
            }
        }

        if (results.length === 0) {
            return NextResponse.json({
                success: false,
                error: process.env.OPENROUTER_API_KEY
                    ? 'OpenRouter returned no output. Check your API key is valid at openrouter.ai'
                    : 'Model returned no output. Run: ollama run qwen3:1.7b "hi" in terminal first, then retry.',
            }, { status: 503 });
        }

        const finalCode = results.length === 1
            ? results[0]
            : results.join('\n\n// ════════════════════════════════\n// Next Section\n// ════════════════════════════════\n\n');

        console.log('[API-TESTING] Done. Final length:', finalCode.length, '| Chunks:', results.length);

        return NextResponse.json({
            success: true,
            code: finalCode,
            model: process.env.OPENROUTER_API_KEY
                ? (process.env.OPENROUTER_MODEL || 'openrouter/auto')
                : ollamaModel,
            type,
            chunks: results.length,
        });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[API-TESTING] Unexpected error:', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}