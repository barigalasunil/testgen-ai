import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { swaggerUrl, swaggerJson, model, testType } = await request.json();

        let specContent = '';

        // If URL provided, fetch the spec
        if (swaggerUrl?.trim()) {
            try {
                const res = await fetch(swaggerUrl.trim());
                if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status}`);
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('yaml') || contentType.includes('text')) {
                    specContent = await res.text();
                } else {
                    const json = await res.json();
                    specContent = JSON.stringify(json, null, 2);
                }
            } catch (fetchErr) {
                return NextResponse.json(
                    { success: false, error: `Could not fetch Swagger URL: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}` },
                    { status: 400 }
                );
            }
        } else if (swaggerJson?.trim()) {
            specContent = swaggerJson.trim();
        } else {
            return NextResponse.json(
                { success: false, error: 'Provide either a Swagger URL or paste the OpenAPI spec.' },
                { status: 400 }
            );
        }

        // Truncate if too large for the model
        if (specContent.length > 6000) {
            specContent = specContent.slice(0, 6000) + '\n... (truncated)';
        }

        const selectedModel = model || 'mistral:7b';
        const type = testType || 'restassured';

        const prompt = buildPrompt(specContent, type);

        const ollamaRes = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                prompt,
                stream: false,
                options: { num_predict: 4000, temperature: 0.2 },
            }),
        });

        if (!ollamaRes.ok) {
            return NextResponse.json(
                { success: false, error: 'Ollama not reachable. Make sure it is running.' },
                { status: 503 }
            );
        }

        const ollamaData = await ollamaRes.json();
        const rawCode = ollamaData.response?.trim() || '';

        return NextResponse.json({
            success: true,
            code: rawCode,
            model: selectedModel,
            type,
        });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

function buildPrompt(spec: string, type: string): string {
    if (type === 'restassured') {
        return `You are a senior QA automation engineer. 
Analyze the following OpenAPI/Swagger specification and generate comprehensive RestAssured (Java) test cases.

SWAGGER SPEC:
${spec}

Generate Java RestAssured test code that covers:
1. Happy path tests for each endpoint (GET, POST, PUT, DELETE)
2. Response status code validation (200, 201, 400, 401, 404, 500)
3. Response body schema validation
4. Required field validation
5. Authentication header tests where applicable

Use this exact format:
- Import statements at top
- One test class named ApiTests
- Each test method annotated with @Test
- Use RestAssured given().when().then() pattern
- Use Hamcrest matchers for assertions
- Add comments explaining each test

Return ONLY the Java code, no explanation outside the code.`;
    }

    if (type === 'scenarios') {
        return `You are a senior QA engineer.
Analyze the following OpenAPI/Swagger specification and generate API test scenarios in plain English.

SWAGGER SPEC:
${spec}

Generate test scenarios covering:
1. Each endpoint with all HTTP methods
2. Positive test cases (valid inputs, expected responses)
3. Negative test cases (invalid inputs, missing fields, wrong types)
4. Authentication scenarios
5. Boundary value tests for numeric fields
6. Edge cases specific to this API

Format each scenario as:
TC-001 | Endpoint | Method | Scenario Title | Test Data | Expected Result

Return ONLY the scenarios table, no explanation.`;
    }

    if (type === 'playwright') {
        return `You are a senior QA automation engineer.
Analyze the following OpenAPI/Swagger specification and generate Playwright API test code (TypeScript).

SWAGGER SPEC:
${spec}

Generate TypeScript Playwright API tests that:
1. Test each endpoint with valid and invalid data
2. Validate response status codes
3. Validate response body structure
4. Test error responses
5. Use request fixtures pattern

Use import {{ test, expect }} from '@playwright/test' pattern.
Return ONLY the TypeScript code, no explanation outside the code.`;
    }

    return `Analyze this API spec and generate test cases:\n${spec}`;
}