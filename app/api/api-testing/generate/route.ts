import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { aiProviderOrchestrator, AiProviderId, ProviderSettings } from '@/src/services/ai/provider-orchestrator';
import { fetchJiraStoryDirect } from '@/app/api/jira/get-story/route';
import { ApiFramework, ApiTestCase } from '@/src/modules/api-testing/types';

type ApiEndpoint = {
    method: string;
    endpoint: string;
    summary?: string;
    requestData?: string;
    responses?: string[];
    authRequired?: boolean;
};

type ApiSource = {
    title: string;
    description: string;
    jiraStoryId?: string;
    raw: string;
    endpoints: ApiEndpoint[];
};

type GenerateRequest = {
    outputMode?: 'testcases' | 'automation';
    inputMode?: 'swagger-url' | 'swagger-upload' | 'curl' | 'raw' | 'postman' | 'jira' | 'url' | 'paste';
    swaggerUrl?: string | null;
    swaggerJson?: string | null;
    curlCommand?: string | null;
    postmanJson?: string | null;
    rawEndpoint?: string | null;
    rawMethod?: string | null;
    rawHeaders?: string | null;
    rawPayload?: string | null;
    jiraStoryId?: string | null;
    jiraUrl?: string | null;
    testType?: string;
    framework?: ApiFramework;
    model?: string;
    provider?: AiProviderId;
    providerSettings?: ProviderSettings;
    testCases?: ApiTestCase[];
};

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function statusForError(error: unknown): number {
    const code = (error as { code?: string }).code;
    if (code === 'MISSING_API_KEY') return 401;
    if (code === 'TIMEOUT') return 408;
    if (code === 'RATE_LIMIT' || code === 'QUOTA_EXCEEDED' || code === 'TOKEN_LIMIT') return 429;
    if (code === 'OLLAMA_OFFLINE' || code === 'NETWORK_ERROR' || code === 'PROVIDER_ERROR') return 503;
    const message = error instanceof Error ? error.message : String(error);
    return /invalid|missing|insufficient/i.test(message) ? 400 : 500;
}

function compactJson(value: unknown): string {
    if (!value) return '';
    try {
        return JSON.stringify(value, null, 2).slice(0, 2000);
    } catch {
        return String(value).slice(0, 2000);
    }
}

async function readSpec(swaggerUrl?: string | null, swaggerJson?: string | null): Promise<string> {
    if (swaggerUrl?.trim()) {
        const url = swaggerUrl.trim();
        if (url.startsWith('/')) {
            return readFileSync(join(process.cwd(), 'public', url), 'utf-8');
        }
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Cannot fetch Swagger/OpenAPI: HTTP ${response.status}`);
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('json')) return JSON.stringify(await response.json(), null, 2);
        return response.text();
    }
    if (swaggerJson?.trim()) return swaggerJson.trim();
    throw new Error('Invalid Swagger/OpenAPI input');
}

function parseJsonSource(raw: string): unknown | null {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function endpointFromOperation(path: string, method: string, operation: Record<string, unknown>): ApiEndpoint {
    const responses = operation.responses && typeof operation.responses === 'object'
        ? Object.keys(operation.responses as Record<string, unknown>)
        : [];
    return {
        method: method.toUpperCase(),
        endpoint: path,
        summary: String(operation.summary || operation.operationId || ''),
        requestData: compactJson(operation.requestBody || operation.parameters),
        responses,
        authRequired: Boolean(operation.security),
    };
}

function parseSwagger(raw: string): ApiSource {
    const spec = parseJsonSource(raw);
    if (!spec || typeof spec !== 'object') {
        const endpoints: ApiEndpoint[] = [];
        const lines = raw.split(/\r?\n/);
        let currentPath = '';
        for (const line of lines) {
            const pathMatch = line.match(/^\s{2,}(\/[^\s:]+):\s*$/);
            if (pathMatch) {
                currentPath = pathMatch[1];
                continue;
            }
            const methodMatch = line.match(/^\s{4,}(get|post|put|patch|delete|head|options):\s*$/i);
            if (currentPath && methodMatch) {
                endpoints.push({
                    method: methodMatch[1].toUpperCase(),
                    endpoint: currentPath,
                    summary: '',
                    responses: [],
                });
            }
        }
        return {
            title: 'OpenAPI Specification',
            description: 'Raw OpenAPI/YAML content',
            raw,
            endpoints,
        };
    }

    const objectSpec = spec as Record<string, unknown>;
    const info = (objectSpec.info || {}) as Record<string, unknown>;
    const paths = (objectSpec.paths || {}) as Record<string, unknown>;
    const endpoints = Object.entries(paths).flatMap(([path, methods]) => {
        if (!methods || typeof methods !== 'object') return [];
        return Object.entries(methods as Record<string, unknown>)
            .filter(([method]) => HTTP_METHODS.includes(method.toLowerCase()))
            .map(([method, operation]) => endpointFromOperation(path, method, (operation || {}) as Record<string, unknown>));
    });

    return {
        title: String(info.title || 'API'),
        description: String(info.description || ''),
        raw,
        endpoints,
    };
}

function parseCurl(command: string): ApiSource {
    const methodMatch = command.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/i);
    const urlMatch = command.match(/https?:\/\/[^\s'"]+/i);
    const bodyMatch = command.match(/(?:--data(?:-raw|-binary)?|-d)\s+(['"])([\s\S]*?)\1/i);
    const headerMatches = Array.from(command.matchAll(/(?:-H|--header)\s+(['"])(.*?)\1/gi)).map(match => match[2]);
    const method = (methodMatch?.[1] || (bodyMatch ? 'POST' : 'GET')).toUpperCase();
    const endpoint = urlMatch?.[0] || '';
    if (!endpoint) throw new Error('Invalid cURL: missing API endpoint');

    return {
        title: 'cURL Request',
        description: headerMatches.join('\n'),
        raw: command,
        endpoints: [{
            method,
            endpoint,
            requestData: bodyMatch?.[2] || '',
            authRequired: headerMatches.some(header => /authorization|api-key|x-api-key/i.test(header)),
        }],
    };
}

function parseRaw(body: GenerateRequest): ApiSource {
    if (!body.rawEndpoint?.trim()) throw new Error('Missing API endpoint');
    return {
        title: 'Raw API Request',
        description: body.rawHeaders || '',
        raw: JSON.stringify({
            method: body.rawMethod || 'GET',
            endpoint: body.rawEndpoint,
            headers: body.rawHeaders,
            body: body.rawPayload,
        }, null, 2),
        endpoints: [{
            method: (body.rawMethod || 'GET').toUpperCase(),
            endpoint: body.rawEndpoint.trim(),
            requestData: body.rawPayload || '',
            authRequired: /authorization|api-key|x-api-key/i.test(body.rawHeaders || ''),
        }],
    };
}

function flattenPostmanItems(items: unknown[], endpoints: ApiEndpoint[] = []): ApiEndpoint[] {
    for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const objectItem = item as Record<string, unknown>;
        if (Array.isArray(objectItem.item)) {
            flattenPostmanItems(objectItem.item, endpoints);
            continue;
        }
        const request = objectItem.request as Record<string, unknown> | undefined;
        if (!request) continue;
        const url = request.url;
        const endpoint = typeof url === 'string'
            ? url
            : Array.isArray((url as Record<string, unknown> | undefined)?.raw)
                ? ''
                : String((url as Record<string, unknown> | undefined)?.raw || '');
        endpoints.push({
            method: String(request.method || 'GET').toUpperCase(),
            endpoint,
            summary: String(objectItem.name || ''),
            requestData: compactJson(request.body),
            authRequired: Boolean(request.auth),
        });
    }
    return endpoints;
}

function parsePostman(raw: string): ApiSource {
    const collection = parseJsonSource(raw);
    if (!collection || typeof collection !== 'object') throw new Error('Invalid Postman collection JSON');
    const objectCollection = collection as Record<string, unknown>;
    const info = (objectCollection.info || {}) as Record<string, unknown>;
    const endpoints = flattenPostmanItems(Array.isArray(objectCollection.item) ? objectCollection.item : []);
    return {
        title: String(info.name || 'Postman Collection'),
        description: String(info.description || ''),
        raw,
        endpoints,
    };
}

function extractJiraId(input?: string | null): string {
    return input?.match(/[A-Z][A-Z0-9]+-\d+/)?.[0] || '';
}

function parseJiraApiDetails(storyId: string, storyText: string): ApiSource {
    const methodPattern = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+((?:https?:\/\/|\/)[^\s,;]+)/gi;
    const endpoints = Array.from(storyText.matchAll(methodPattern)).map(match => ({
        method: match[1].toUpperCase(),
        endpoint: match[2],
        summary: `From Jira story ${storyId}`,
        requestData: '',
        authRequired: /auth|token|bearer|api key/i.test(storyText),
    }));
    if (endpoints.length === 0) {
        throw new Error('Insufficient API information');
    }
    return {
        title: `Jira ${storyId}`,
        description: storyText.slice(0, 1000),
        jiraStoryId: storyId,
        raw: storyText,
        endpoints,
    };
}

async function resolveApiSource(body: GenerateRequest): Promise<ApiSource> {
    const mode = body.inputMode === 'url' ? 'swagger-url' : body.inputMode === 'paste' ? 'swagger-upload' : body.inputMode;
    if (mode === 'swagger-url' || mode === 'swagger-upload') return parseSwagger(await readSpec(body.swaggerUrl, body.swaggerJson));
    if (mode === 'curl') return parseCurl(body.curlCommand || '');
    if (mode === 'raw') return parseRaw(body);
    if (mode === 'postman') return parsePostman(body.postmanJson || '');
    if (mode === 'jira') {
        const storyId = body.jiraStoryId || extractJiraId(body.jiraUrl);
        if (!storyId) throw new Error('Missing Jira story ID');
        const result = await fetchJiraStoryDirect(storyId);
        if (!result.success) throw new Error(result.error || 'Jira fetch failed');
        return parseJiraApiDetails(storyId, [result.summary, result.description, result.acceptanceCriteria].filter(Boolean).join('\n\n'));
    }
    throw new Error('Unsupported API input type');
}

function expectedStatus(endpoint: ApiEndpoint, fallback = '200'): string {
    const first2xx = endpoint.responses?.find(code => /^2\d\d$/.test(code));
    return first2xx || fallback;
}

function buildApiTestCases(source: ApiSource): ApiTestCase[] {
    if (source.endpoints.length === 0) throw new Error('Invalid Swagger/OpenAPI: no endpoints found');
    const testCases: ApiTestCase[] = [];
    let index = 1;
    const add = (endpoint: ApiEndpoint, testType: ApiTestCase['testType'], title: string, expectedStatusCode: string, priority: ApiTestCase['priority'], requestData = endpoint.requestData || '') => {
        testCases.push({
            testCaseId: `API-TC-${String(index++).padStart(3, '0')}`,
            apiScenario: `${endpoint.method} ${endpoint.endpoint} - ${title}`,
            method: endpoint.method,
            endpoint: endpoint.endpoint,
            preconditions: endpoint.authRequired ? 'Valid API credentials are available unless testing auth failure.' : 'API is reachable and test data is available.',
            requestData,
            steps: [
                `Prepare ${endpoint.method} request for ${endpoint.endpoint}`,
                'Apply documented headers, path params, query params, and body',
                'Send request',
                'Validate status code, response body, headers, and schema where documented',
            ].join('\n'),
            expectedStatusCode,
            expectedResult: title,
            testType,
            priority,
        });
    };

    source.endpoints.forEach(endpoint => {
        add(endpoint, 'Positive', endpoint.summary || 'Valid request succeeds', expectedStatus(endpoint), 'P1');
        add(endpoint, 'Negative', 'Invalid or missing request data is rejected', endpoint.responses?.includes('400') ? '400' : '4xx', 'P1', 'Invalid or incomplete request payload');
        add(endpoint, 'Auth', 'Missing or invalid authentication is rejected', endpoint.responses?.includes('401') ? '401' : '401/403', endpoint.authRequired ? 'P1' : 'P2', 'Request without Authorization header');
        add(endpoint, 'Schema', 'Response schema matches documented contract', expectedStatus(endpoint), 'P2');
        add(endpoint, 'Boundary', 'Boundary values are handled correctly', endpoint.responses?.includes('400') ? '400/2xx' : 'Documented 2xx/4xx', 'P2', 'Boundary values for documented params and body fields');
        if (endpoint.responses?.some(code => code === '429')) {
            add(endpoint, 'Rate Limit', 'Rate limit response is handled as documented', '429', 'P2');
        }
    });

    return testCases;
}

function formatGeneratedTestCases(testCases?: ApiTestCase[]): string {
    if (!testCases?.length) return '';
    return testCases.map(testCase => [
        `- ${testCase.testCaseId}: ${testCase.method} ${testCase.endpoint}`,
        `  Scenario: ${testCase.apiScenario}`,
        `  Expected: ${testCase.expectedStatusCode} - ${testCase.expectedResult}`,
        `  Type/Priority: ${testCase.testType}/${testCase.priority}`,
    ].join('\n')).join('\n');
}

function frameworkPrompt(source: ApiSource, framework: ApiFramework, testCases?: ApiTestCase[]): string {
    const generatedTestCaseBlock = formatGeneratedTestCases(testCases);
    const base = `API SOURCE:
Title: ${source.title}
Description: ${source.description}
Endpoints:
${source.endpoints.map(endpoint => `- ${endpoint.method} ${endpoint.endpoint} ${endpoint.summary || ''}`).join('\n')}

Generated API test cases to automate:
${generatedTestCaseBlock || 'No structured API test cases were provided. Create automation from the documented endpoints only.'}

Raw contract excerpt:
${source.raw.slice(0, 12000)}`;

    if (framework === 'restassured') {
        return `Generate Java Maven/TestNG Rest Assured API automation for this API.
Include request specs, test classes, assertions, and schema validation where possible.
Return only code and file sections.

${base}`;
    }
    if (framework === 'newman') {
        return `Generate a valid Postman collection JSON and environment JSON for Newman execution.
Include tests for status, response body, headers, and schema where possible.
Return only JSON-compatible content.

${base}`;
    }
    return `Generate TypeScript Playwright API tests using @playwright/test request context.
Include status, body, header, and schema assertions where possible.
Return only TypeScript code.

${base}`;
}

async function generateAutomation(source: ApiSource, body: GenerateRequest): Promise<string> {
    const framework = body.framework || (body.testType === 'newman' ? 'newman' : body.testType === 'restassured' ? 'restassured' : 'playwright');
    const result = await aiProviderOrchestrator.generate(body.provider || 'auto', {
        prompt: frameworkPrompt(source, framework, body.testCases),
        model: body.model,
        settings: body.providerSettings,
        maxTokens: 4096,
        temperature: 0.2,
    });
    return result.content;
}

export async function POST(req: Request) {
    try {
        const body = await req.json() as GenerateRequest;
        const source = await resolveApiSource(body);

        if (body.outputMode === 'testcases') {
            const testCases = buildApiTestCases(source);
            return NextResponse.json({
                success: true,
                source: {
                    title: source.title,
                    description: source.description,
                    jiraStoryId: source.jiraStoryId,
                    endpointCount: source.endpoints.length,
                    endpoints: source.endpoints,
                },
                testCases,
            });
        }

        const code = await generateAutomation(source, body);
        return NextResponse.json({
            success: true,
            code,
            type: body.testType || body.framework || 'playwright',
            model: body.model || 'auto',
            source: {
                title: source.title,
                jiraStoryId: source.jiraStoryId,
                endpointCount: source.endpoints.length,
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ success: false, error: message, code: (err as { code?: string }).code }, { status: statusForError(err) });
    }
}
