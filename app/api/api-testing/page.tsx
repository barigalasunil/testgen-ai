"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, Download, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSavedModel, getAiLabel, getSavedProvider, loadProviderSettings } from "@/src/services/ai/ai-config.service";

type TestType = 'restassured' | 'scenarios' | 'playwright';
type ParsedSpec = {
    title: string;
    version: string;
    description: string;
    endpointCount: number;
    endpoints: { method: string; path: string; summary: string }[];
    rawSpec: string;
};

const TEST_TYPES: { key: TestType; label: string; description: string }[] = [
    { key: 'restassured', label: 'RestAssured (Java)', description: 'Generate Java RestAssured test class' },
    { key: 'scenarios', label: 'Test Scenarios', description: 'Plain English test scenarios table' },
    { key: 'playwright', label: 'Playwright API (TS)', description: 'TypeScript Playwright API tests' },
];

const SAMPLE_URLS = [
    { label: 'SauceDemo API (Mock)', url: '/saucedemo-api-spec.json' },
    { label: 'Petstore v2 (JSON)', url: 'https://petstore.swagger.io/v2/swagger.json' },
    { label: 'Petstore v3 (OpenAPI 3.0)', url: 'https://petstore3.swagger.io/api/v3/openapi.json' },
];

export default function ApiTestingPage() {
    const [swaggerUrl, setSwaggerUrl] = useState('');
    const [swaggerJson, setSwaggerJson] = useState('');
    const [inputMode, setInputMode] = useState<'url' | 'paste'>('url');
    const [testType, setTestType] = useState<TestType>('restassured');
    const [model] = useState(getSavedModel);
    const [parsedSpec, setParsedSpec] = useState<ParsedSpec | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [savingToJira, setSavingToJira] = useState(false);
    const [jiraResult, setJiraResult] = useState<{key?: string; url?: string; error?: string} | null>(null);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    const aiLabel = getAiLabel();

    const handleParseSpec = async () => {
        if (!swaggerUrl.trim()) return;
        setIsParsing(true);
        setError('');
        setParsedSpec(null);
        try {
            const res = await fetch('/api/api-testing/parse-swagger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: swaggerUrl }),
            });
            const data = await res.json();
            if (data.success) {
                setParsedSpec(data);
            } else {
                setError(data.error || 'Failed to parse spec');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsParsing(false);
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError('');
        setGeneratedCode('');
        try {
            const res = await fetch('/api/api-testing/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    swaggerUrl: inputMode === 'url' ? swaggerUrl : undefined,
                    swaggerJson: inputMode === 'paste' ? swaggerJson : undefined,
                    model,
                    provider: getSavedProvider(),
                    providerSettings: loadProviderSettings(),
                    testType,
                }),
            });
            
            let data;
            try {
                data = await res.json();
            } catch (jsonErr) {
                const text = await res.text();
                console.error('[CLIENT] JSON parse failed. Status:', res.status, 'Text:', text);
                throw new Error(`Server error: ${res.status} ${text.slice(0, 200)}`);
            }
            
            if (data.success) {
                let code = data.code || '';
                if (testType === 'restassured') {
                    const hasClass = /class\s+\w+/.test(code);
                    if (!hasClass) {
                        const header = `import org.junit.Test;\nimport static io.restassured.RestAssured.*;\nimport static org.hamcrest.Matchers.*;\n\n`;
                        const body = code.split('\n').map((l: string) => '    ' + l).join('\n');
                        code = header + `public class ApiTests {\n` + body + `\n}`;
                    }
                }
                setGeneratedCode(code);
            } else {
                setError(data.error || 'Generation failed');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[CLIENT] Generate error:', msg);
            setError(msg || 'Failed to generate. Check Ollama is running: ollama serve');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedCode);
        showToast('Copied to clipboard');
    };

    const handleDownload = () => {
        const ext = testType === 'restassured' ? 'java' : testType === 'playwright' ? 'ts' : 'txt';
        const filename = `api-tests.${ext}`;
        const blob = new Blob([generatedCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Downloaded ${filename}`);
    };

    const handleSaveToJira = async () => {
        if (!generatedCode) return;
        setSavingToJira(true);
        setJiraResult(null);
        try {
            const { loadJiraCredentials } = await import('@/src/services/jira/jira.service');
            const credentials = loadJiraCredentials();
            // If local credentials are not configured, continue and let the server
            // fall back to environment variables (server-side Jira config).

            const summary = `[API Tests] ${parsedSpec?.title || 'API Testing'} — ${testType} (${new Date().toLocaleDateString()})`;
            const description = `Generated by TCGen-Buddy API Testing Assistant.\n\nModel: ${generatedCode.split('\n')[0]}\nType: ${testType}\n\nGenerated Code:\n\n${generatedCode.slice(0, 2000)}${generatedCode.length > 2000 ? '\n...(truncated)' : ''}`;

            const res = await fetch('/api/jira/create-issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary,
                    description,
                    issueType: 'Task',
                    priority: 'Medium',
                    labels: ['api-testing', 'tcgen-buddy', testType],
                    credentials,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setJiraResult({ key: data.issueKey, url: data.issueUrl });
                showToast(`✓ Created ${data.issueKey} in Jira`);
            } else {
                setJiraResult({ error: data.error || 'Failed to create Jira ticket' });
            }
        } catch (e) {
            setJiraResult({ error: e instanceof Error ? e.message : String(e) });
        } finally {
            setSavingToJira(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Module 3</p>
                    <h1 className="text-xl font-bold text-slate-900">API Testing Assistant</h1>
                    <p className="text-xs text-slate-500 mt-0.5">Generate RestAssured, Playwright, or scenario-based API tests from Swagger/OpenAPI specs</p>
                </div>
                <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg">
                    ← Back to TCGen
                </Link>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Left — Input panel */}
                <div className="flex flex-col gap-4">

                    {/* Input mode toggle */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-800 mb-3">API Specification Input</h2>

                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setInputMode('url')}
                                className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition",
                                    inputMode === 'url' ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                🔗 Swagger URL
                            </button>
                            <button
                                onClick={() => setInputMode('paste')}
                                className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition",
                                    inputMode === 'paste' ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                📋 Paste JSON/YAML
                            </button>
                        </div>

                        {inputMode === 'url' ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={swaggerUrl}
                                        onChange={e => setSwaggerUrl(e.target.value)}
                                        placeholder="https://petstore.swagger.io/v2/swagger.json"
                                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={handleParseSpec}
                                        disabled={isParsing || !swaggerUrl.trim()}
                                        className="px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
                                    >
                                        {isParsing ? 'Loading...' : 'Load Spec'}
                                    </button>
                                </div>
                                {/* Sample URLs */}
                                <div className="flex gap-2 flex-wrap">
                                    <span className="text-xs text-slate-400">Try:</span>
                                    {SAMPLE_URLS.map(s => (
                                        <button key={s.url} onClick={() => setSwaggerUrl(s.url)}
                                            className="text-xs text-blue-600 hover:underline">
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <textarea
                                value={swaggerJson}
                                onChange={e => setSwaggerJson(e.target.value)}
                                placeholder='Paste your OpenAPI JSON or YAML spec here...'
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-40"
                            />
                        )}
                    </div>

                    {/* Parsed spec preview */}
                    {parsedSpec && (
                        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <h3 className="text-sm font-semibold text-slate-800">Spec Loaded: {parsedSpec.title}</h3>
                                <span className="text-xs text-slate-400 ml-auto">v{parsedSpec.version}</span>
                            </div>
                            {parsedSpec.description && (
                                <p className="text-xs text-slate-500 mb-3">{parsedSpec.description.slice(0, 150)}</p>
                            )}
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-semibold">
                                    {parsedSpec.endpointCount} endpoints
                                </span>
                            </div>
                            <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                                {parsedSpec.endpoints.map((ep, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-slate-50">
                                        <span className={cn("px-1.5 py-0.5 rounded font-bold font-mono text-[10px] min-w-[44px] text-center",
                                            ep.method === 'GET' ? 'bg-green-100 text-green-700' :
                                            ep.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                                            ep.method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                                            ep.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                                            'bg-slate-100 text-slate-700'
                                        )}>
                                            {ep.method}
                                        </span>
                                        <span className="font-mono text-slate-600">{ep.path}</span>
                                        {ep.summary && <span className="text-slate-400 truncate">{ep.summary}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Test type selector */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-800 mb-3">Test Output Type</h2>
                        <div className="flex flex-col gap-2">
                            {TEST_TYPES.map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setTestType(t.key)}
                                    className={cn("flex items-start gap-3 p-3 rounded-xl border text-left transition",
                                        testType === t.key
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                    )}
                                >
                                    <div className={cn("w-4 h-4 rounded-full border-2 mt-0.5 shrink-0",
                                        testType === t.key ? "border-blue-500 bg-blue-500" : "border-slate-300"
                                    )} />
                                    <div>
                                        <p className={cn("text-sm font-semibold", testType === t.key ? "text-blue-700" : "text-slate-700")}>
                                            {t.label}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* AI Model — reads from global config */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-slate-800">AI Provider</h2>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                                {aiLabel}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">Configured globally in the main workspace. <Link href="/" className="text-blue-600 hover:underline">Change here →</Link></p>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || (!swaggerUrl.trim() && !swaggerJson.trim())}
                        className="w-full py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                Generating tests...
                            </>
                        ) : (
                            '⚡ Generate API Tests'
                        )}
                    </button>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}
                    {jiraResult && (
                        <div className={cn(
                            "rounded-xl px-4 py-3 text-sm flex items-center gap-2",
                            jiraResult.key
                                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                : "bg-red-50 border border-red-200 text-red-700"
                        )}>
                            {jiraResult.key ? (
                                <>
                                    ✓ Created
                                    <a href={jiraResult.url} target="_blank" rel="noreferrer"
                                        className="font-bold underline">
                                        {jiraResult.key}
                                    </a>
                                    in Jira
                                </>
                            ) : (
                                <span>✕ {jiraResult.error}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Right — Generated code */}
                <div className="flex flex-col gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col" style={{ minHeight: '600px' }}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                            <div>
                                <h2 className="text-sm font-semibold text-slate-800">Generated Test Code</h2>
                                <p className="text-xs text-slate-400">
                                    {generatedCode
                                        ? `${generatedCode.split('\n').length} lines · ${testType}`
                                        : 'Output will appear here'}
                                </p>
                            </div>
                            {generatedCode && (
                                <div className="flex gap-2">
                                    <button onClick={handleCopy}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                                        <Copy className="w-3.5 h-3.5" /> Copy
                                    </button>
                                    <button onClick={handleDownload}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                                        <Download className="w-3.5 h-3.5" /> Download
                                    </button>
                                    <button onClick={handleSaveToJira} disabled={savingToJira}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                                        {savingToJira ? (
                                            <><span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> Saving...</>
                                        ) : '📋 Save to Jira'}
                                    </button>
                                    <button onClick={handleGenerate} disabled={isGenerating}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 bg-slate-950 rounded-b-2xl overflow-auto">
                            {generatedCode ? (
                                <pre className="p-4 text-xs text-slate-100 font-mono whitespace-pre-wrap leading-relaxed">
                                    {generatedCode}
                                </pre>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 p-8">
                                    <div className="text-4xl">⚡</div>
                                    <p className="text-sm text-center">
                                        {isGenerating
                                            ? 'AI is analyzing your API spec and generating tests...'
                                            : 'Enter a Swagger URL or paste your OpenAPI spec, then click Generate'}
                                    </p>
                                    {isGenerating && (
                                        <div className="flex gap-1">
                                            {[0, 150, 300].map(d => (
                                                <span key={d} className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${d}ms` }} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick reference */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sample Swagger URLs to test with</h3>
                        <div className="flex flex-col gap-2">
                            {[
                                { name: 'SauceDemo API', url: '/saucedemo-api-spec.json', desc: 'Login, inventory, cart, checkout endpoints' },
                                { name: 'Swagger Petstore v2', url: 'https://petstore.swagger.io/v2/swagger.json', desc: 'Classic REST API — 20 endpoints' },
                                { name: 'Swagger Petstore v3', url: 'https://petstore3.swagger.io/api/v3/openapi.json', desc: 'OpenAPI 3.0 — 19 endpoints' },
                            ].map(api => (
                                <div key={api.url} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 hover:border-slate-200 hover:bg-slate-50 transition">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-700">{api.name}</p>
                                        <p className="text-xs text-slate-400">{api.desc}</p>
                                    </div>
                                    <button
                                        onClick={() => { setSwaggerUrl(api.url); setInputMode('url'); }}
                                        className="text-xs text-blue-600 hover:underline ml-3 whitespace-nowrap"
                                    >
                                        Use this ↗
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
