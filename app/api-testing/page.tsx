"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Copy, Download, RefreshCw, CheckCircle2, AlertCircle, Play, Terminal, Bug, ExternalLink, FileCode, ListChecks, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSavedModel, getAiLabel, getSavedProvider, loadProviderSettings } from "@/src/services/ai/ai-config.service";
import { loadJiraCredentials } from '@/src/services/jira/jira.service';

type TestType = 'restassured' | 'scenarios' | 'manual' | 'playwright' | 'newman';
type InputMode = 'url' | 'paste' | 'curl' | 'postman' | 'raw';
type AnalysisStep = 'idle' | 'analyzing' | 'generating' | 'positive' | 'negative' | 'edge' | 'automation' | 'done';

type ParsedSpec = {
    title: string;
    version: string;
    description: string;
    endpointCount: number;
    endpoints: { method: string; path: string; summary: string }[];
    rawSpec: string;
};

type ExecutionResult = {
    endpoint: string;
    method: string;
    status: number | string;
    passed: boolean;
    responseTime: string;
    responsePreview: string;
    error?: string;
};

const TEST_TYPES: { key: TestType; label: string; description: string; buttonLabel: string; downloadExt: string }[] = [
    { key: 'restassured', label: 'RestAssured (Java)', description: 'Java RestAssured test class with Maven', buttonLabel: 'Generate RestAssured Tests', downloadExt: 'java' },
    { key: 'scenarios', label: 'Test Scenarios', description: 'Plain English scenario table', buttonLabel: 'Generate Test Scenarios', downloadExt: 'txt' },
    { key: 'manual', label: 'Manual API Test Cases', description: 'Industry standard manual test cases', buttonLabel: 'Generate Manual Test Cases', downloadExt: 'txt' },
    { key: 'playwright', label: 'Playwright API (TS)', description: 'TypeScript Playwright API tests', buttonLabel: 'Generate Playwright Tests', downloadExt: 'ts' },
    { key: 'newman', label: 'Newman / Postman', description: 'Postman collection JSON for Newman CLI', buttonLabel: 'Generate Postman Collection', downloadExt: 'json' },
];

const SAMPLE_URLS = [
    { label: 'SauceDemo API (Mock)', url: '/saucedemo-api-spec.json' },
    { label: 'Petstore v2 (JSON)', url: 'https://petstore.swagger.io/v2/swagger.json' },
    { label: 'Petstore v3 (OpenAPI 3.0)', url: 'https://petstore3.swagger.io/api/v3/openapi.json' },
];

const INPUT_MODE_TABS: { key: InputMode; label: string; icon: string }[] = [
    { key: 'url', label: 'Swagger URL', icon: '🔗' },
    { key: 'paste', label: 'Paste JSON/YAML', icon: '📋' },
    { key: 'curl', label: 'cURL', icon: '⬆' },
    { key: 'postman', label: 'Postman Collection', icon: '📦' },
    { key: 'raw', label: 'Raw Request', icon: '✏' },
];

export default function ApiTestingPage() {
    const [swaggerUrl, setSwaggerUrl] = useState('');
    const [swaggerJson, setSwaggerJson] = useState('');
    const [curlCommand, setCurlCommand] = useState('');
    const [postmanJson, setPostmanJson] = useState('');
    const [rawPayload, setRawPayload] = useState('');
    const [rawMethod, setRawMethod] = useState('GET');
    const [rawEndpoint, setRawEndpoint] = useState('');
    const [inputMode, setInputMode] = useState<InputMode>('url');
    const [testType, setTestType] = useState<TestType>('restassured');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [parsedSpec, setParsedSpec] = useState<ParsedSpec | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle');
    const [execResults, setExecResults] = useState<ExecutionResult[]>([]);
    const [executing, setExecuting] = useState(false);
    const [execLog, setExecLog] = useState<string[]>([]);
    const [savingToJira, setSavingToJira] = useState(false);
    const [jiraResult, setJiraResult] = useState<{ key?: string; url?: string; error?: string } | null>(null);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ msg: string; url?: string } | null>(null);
    const [aiProvider, setAiProvider] = useState<'cloud' | 'local' | 'unknown'>('unknown');
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = (msg: string, url?: string) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast({ msg, url });
        // Sticky when Jira URL present — must be manually dismissed
        if (!url) {
            toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
        }
    };

    useEffect(() => {
        fetch('/api/models')
            .then(r => r.json())
            .then(data => {
                if (data.models && data.models.length > 0) {
                    setAvailableModels(data.models);
                }
            })
            .catch(() => { })
            .finally(() => setModelsLoading(false));

        const provider = getSavedProvider();
        fetch(`/api/health?provider=${provider}`)
            .then(r => r.json())
            .then(data => {
                if (data.connected) {
                    setAiProvider(data.provider === 'cloud' ? 'cloud' : 'local');
                } else {
                    setAiProvider('unknown');
                }
            })
            .catch(() => setAiProvider('unknown'));
    }, []);

    const activeModel = getSavedModel();
    const aiLabel = getAiLabel();

    const resolveSpecInput = useCallback((): string | null => {
        switch (inputMode) {
            case 'url': return swaggerUrl.trim() || null;
            case 'paste': return swaggerJson.trim() || null;
            case 'curl': return curlCommand.trim() || null;
            case 'postman': return postmanJson.trim() || null;
            case 'raw': return rawEndpoint.trim() ? JSON.stringify({ method: rawMethod, endpoint: rawEndpoint, body: rawPayload }) : null;
        }
    }, [inputMode, swaggerUrl, swaggerJson, curlCommand, postmanJson, rawMethod, rawEndpoint, rawPayload]);

    const hasInput = !!resolveSpecInput();

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
            if (data.success) setParsedSpec(data);
            else setError(data.error || 'Failed to parse spec');
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
        setExecResults([]);
        setAnalysisStep('analyzing');
        setExecLog([]);

        const input = resolveSpecInput();
        if (!input) {
            setError('No input provided');
            setIsGenerating(false);
            setAnalysisStep('idle');
            return;
        }

        const steps: AnalysisStep[] = ['generating', 'positive', 'negative', 'edge', 'automation'];
        let stepIdx = 0;
        const advanceStep = () => {
            if (stepIdx < steps.length) {
                setAnalysisStep(steps[stepIdx]);
                stepIdx++;
            } else {
                setAnalysisStep('done');
            }
        };
        advanceStep();

        try {
            const res = await fetch('/api/api-testing/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    swaggerUrl: inputMode === 'url' ? swaggerUrl.trim() || null : null,
                    swaggerJson: inputMode === 'paste' ? swaggerJson.trim() || null : null,
                    curlCommand: inputMode === 'curl' ? curlCommand.trim() || null : null,
                    postmanJson: inputMode === 'postman' ? postmanJson.trim() || null : null,
                    rawEndpoint: inputMode === 'raw' ? rawEndpoint.trim() || null : null,
                    rawMethod: inputMode === 'raw' ? rawMethod : null,
                    rawPayload: inputMode === 'raw' ? rawPayload.trim() || null : null,
                    model: activeModel,
                    provider: getSavedProvider(),
                    providerSettings: loadProviderSettings(),
                    testType,
                    inputMode,
                }),
            });

            let data;
            try {
                data = await res.json();
            } catch (jsonErr) {
                const text = await res.text();
                throw new Error(`Server error: ${res.status} ${text.slice(0, 200)}`);
            }

            advanceStep();

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
                while (stepIdx < steps.length) advanceStep();
                setAnalysisStep('done');
            } else {
                setError(data.error || 'Generation failed');
                setAnalysisStep('idle');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg || 'Failed to generate.');
            setAnalysisStep('idle');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExecute = async () => {
        if (!generatedCode) return;
        setExecuting(true);
        setExecResults([]);
        setExecLog(l => [...l, `[${new Date().toLocaleTimeString()}] Starting API validations...`]);

        const endpoints = parsedSpec?.endpoints || [
            { method: 'GET', path: '/', summary: 'Root endpoint' }
        ];

        for (const ep of endpoints.slice(0, 5)) {
            const start = performance.now();
            setExecLog(l => [...l, `[${new Date().toLocaleTimeString()}] Testing ${ep.method} ${ep.path}...`]);
            try {
                const res = await fetch('/api/api-testing/debug', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        endpoint: ep.path,
                        method: ep.method,
                    }),
                });
                const duration = ((performance.now() - start) / 1000).toFixed(2);
                const result: ExecutionResult = {
                    endpoint: ep.path,
                    method: ep.method,
                    status: res.status,
                    passed: res.ok,
                    responseTime: `${duration}s`,
                    responsePreview: '',
                };
                setExecResults(prev => [...prev, result]);
                setExecLog(l => [...l, `[${new Date().toLocaleTimeString()}] ${res.ok ? 'PASS' : 'FAIL'} ${ep.method} ${ep.path} → ${res.status} (${duration}s)`]);
            } catch (err) {
                const result: ExecutionResult = {
                    endpoint: ep.path,
                    method: ep.method,
                    status: 'ERROR',
                    passed: false,
                    responseTime: '—',
                    responsePreview: '',
                    error: err instanceof Error ? err.message : String(err),
                };
                setExecResults(prev => [...prev, result]);
                setExecLog(l => [...l, `[${new Date().toLocaleTimeString()}] ERROR ${ep.method} ${ep.path}: ${result.error}`]);
            }
        }
        setExecLog(l => [...l, `[${new Date().toLocaleTimeString()}] Validations complete.`]);
        setExecuting(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedCode);
        showToast('Copied to clipboard');
    };

    const handleDownload = () => {
        const typeConfig = TEST_TYPES.find(t => t.key === testType);
        const ext = typeConfig?.downloadExt || 'txt';
        const filename = `api-tests-${testType}.${ext}`;
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
            const credentials = loadJiraCredentials();
            const typeLabel = TEST_TYPES.find(t => t.key === testType)?.label || testType;
            const summary = `[API Tests] ${parsedSpec?.title || 'API Testing'} \u2014 ${typeLabel} (${new Date().toLocaleDateString()})`;
            const codeBlock = generatedCode.slice(0, 25000);
            const codeHeader = `Generated by TCGen-Buddy API Testing Assistant\nModel: ${aiLabel}\nType: ${typeLabel}\n\n`;
            const description = codeHeader + codeBlock;

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
                    traceability: parsedSpec?.title ? { label: parsedSpec.title, sourceId: parsedSpec.title } : undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setJiraResult({ key: data.issueKey, url: data.issueUrl });
                showToast(`Created ${data.issueKey} in Jira — click to open`, data.issueUrl);
            } else {
                setJiraResult({ error: data.error || 'Failed to create Jira ticket' });
            }
        } catch (e) {
            setJiraResult({ error: e instanceof Error ? e.message : String(e) });
        } finally {
            setSavingToJira(false);
        }
    };

    const renderInputSection = () => (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">API Input</h2>
            <div className="flex gap-2 mb-4 flex-wrap">
                {INPUT_MODE_TABS.map(t => (
                    <button key={t.key} onClick={() => setInputMode(t.key)}
                        className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap",
                            inputMode === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {inputMode === 'url' && (
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <input type="text" value={swaggerUrl} onChange={e => setSwaggerUrl(e.target.value)}
                            placeholder="https://petstore.swagger.io/v2/swagger.json"
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={handleParseSpec} disabled={isParsing || !swaggerUrl.trim()}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">
                            {isParsing ? 'Loading...' : 'Load Spec'}
                        </button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <span className="text-xs text-slate-400">Try:</span>
                        {SAMPLE_URLS.map(s => (
                            <button key={s.url} onClick={() => setSwaggerUrl(s.url)}
                                className="text-xs text-blue-600 hover:underline">{s.label}</button>
                        ))}
                    </div>
                </div>
            )}
            {inputMode === 'paste' && (
                <textarea value={swaggerJson} onChange={e => setSwaggerJson(e.target.value)}
                    placeholder="Paste your OpenAPI JSON or YAML spec here..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-40" />
            )}
            {inputMode === 'curl' && (
                <div className="flex flex-col gap-2">
                    <textarea value={curlCommand} onChange={e => setCurlCommand(e.target.value)}
                        placeholder={'curl -X GET https://api.example.com/users \\\n  -H "Authorization: Bearer token"'}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-28" />
                    <p className="text-[10px] text-slate-400">Paste any cURL command. The AI will analyze and generate tests from it.</p>
                </div>
            )}
            {inputMode === 'postman' && (
                <div className="flex flex-col gap-2">
                    <textarea value={postmanJson} onChange={e => setPostmanJson(e.target.value)}
                        placeholder={'{\n  "info": { "name": "My API", "schema": "https://schema.getpostman.com/..." },\n  "item": [...]\n}'}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-40" />
                    <p className="text-[10px] text-slate-400">Export your Postman collection as JSON v2.1 and paste it here.</p>
                </div>
            )}
            {inputMode === 'raw' && (
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <select value={rawMethod} onChange={e => setRawMethod(e.target.value)}
                            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => (
                                <option key={m}>{m}</option>
                            ))}
                        </select>
                        <input type="text" value={rawEndpoint} onChange={e => setRawEndpoint(e.target.value)}
                            placeholder="/api/v1/users"
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                    </div>
                    <textarea value={rawPayload} onChange={e => setRawPayload(e.target.value)}
                        placeholder='{"key": "value"}  (optional request body for POST/PUT/PATCH)'
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24" />
                </div>
            )}
        </div>
    );

    const renderAnalysisProgress = () => {
        if (analysisStep === 'idle') return null;
        const steps = [
            { key: 'analyzing' as const, label: 'Analyzing API structure...', icon: '🔍' },
            { key: 'generating' as const, label: 'Generating test cases...', icon: '📝' },
            { key: 'positive' as const, label: 'Creating positive scenarios...', icon: '✅' },
            { key: 'negative' as const, label: 'Building negative validations...', icon: '🛡' },
            { key: 'edge' as const, label: 'Adding edge cases...', icon: '⚡' },
            { key: 'automation' as const, label: 'Generating automation scripts...', icon: '🤖' },
        ];
        const currentIdx = steps.findIndex(s => s.key === analysisStep);
        return (
            <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                <div className="flex flex-col gap-2">
                    {steps.map((s, i) => (
                        <div key={s.key} className={cn(
                            "flex items-center gap-2 text-xs transition-colors",
                            i < currentIdx ? "text-emerald-600" : i === currentIdx ? "text-blue-600 font-semibold" : "text-slate-300"
                        )}>
                            <span>{i < currentIdx ? '✓' : i === currentIdx ? '⟳' : '○'}</span>
                            <span>{s.icon} {s.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderExecutionDashboard = () => {
        if (!generatedCode) return null;
        const passed = execResults.filter(r => r.passed).length;
        const failed = execResults.filter(r => !r.passed).length;
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-slate-500" />
                        API Execution Dashboard
                    </h3>
                    <button onClick={handleExecute} disabled={executing}
                        className={cn(
                            "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold transition",
                            executing ? "bg-slate-200 text-slate-400" : "bg-emerald-600 text-white hover:bg-emerald-700"
                        )}>
                        {executing ? (
                            <><span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> Running...</>
                        ) : (
                            <><Play className="w-3.5 h-3.5" /> Execute Validations</>
                        )}
                    </button>
                </div>
                {execResults.length > 0 && (
                    <div className="mb-3 flex gap-3 text-xs">
                        <span className="text-emerald-600 font-semibold">✓ {passed} passed</span>
                        <span className="text-red-600 font-semibold">✕ {failed} failed</span>
                        <span className="text-slate-400">{execResults.length} total</span>
                    </div>
                )}
                <div className="max-h-48 overflow-y-auto flex flex-col gap-1 text-xs font-mono">
                    {execResults.map((r, i) => (
                        <div key={i} className={cn(
                            "flex items-center gap-2 px-2 py-1 rounded",
                            r.passed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        )}>
                            <span>{r.passed ? '✓' : '✕'}</span>
                            <span className="font-bold">{r.method}</span>
                            <span className="text-slate-600">{r.endpoint}</span>
                            <span className="ml-auto">{r.status} · {r.responseTime}</span>
                        </div>
                    ))}
                </div>
                {execLog.length > 0 && (
                    <div className="mt-2">
                        <button onClick={() => setExecLog([])}
                            className="text-[10px] text-slate-400 hover:text-slate-600 mb-1">Clear Log</button>
                        <div className="bg-slate-900 rounded-xl p-2 max-h-32 overflow-y-auto">
                            {execLog.map((l, i) => (
                                <div key={i} className="text-[10px] text-slate-300 font-mono leading-relaxed">{l}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Toast — bottom-right, stays open when Jira URL present */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl max-w-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-sm flex-1">{toast.msg}</span>
                    {toast.url && (
                        <a href={toast.url} target="_blank" rel="noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 underline whitespace-nowrap font-semibold">
                            Open in Jira ↗
                        </a>
                    )}
                    <button onClick={() => setToast(null)}
                        className="ml-1 text-slate-400 hover:text-white text-lg leading-none">
                        ×
                    </button>
                </div>
            )}

            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">AI API Testing Workspace</p>
                    <h1 className="text-xl font-bold text-slate-900">API Testing Assistant</h1>
                    <p className="text-xs text-slate-500 mt-0.5">AI-powered API test generation, automation, and execution dashboard</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                        aiProvider === 'cloud' ? "bg-blue-50 border-blue-200 text-blue-700" :
                        aiProvider === 'local' ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                        "bg-slate-50 border-slate-200 text-slate-500"
                    )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full",
                            aiProvider === 'cloud' ? "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]" :
                            aiProvider === 'local' ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-slate-400"
                        )} />
                        <span className="font-bold uppercase text-[10px]">{aiProvider === 'cloud' ? '☁' : aiProvider === 'local' ? '💻' : '○'}</span>
                        {aiProvider === 'cloud' ? 'Cloud Connected' :
                         aiProvider === 'local' ? 'Local Connected' : 'Connecting...'}
                    </span>
                    <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg">
                        Back to TCGen
                    </Link>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
                {/* Top bar: Test Type + Generate */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex flex-col xl:flex-row gap-4">
                        <div className="flex-1">
                            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Test Output Type</h2>
                            <div className="flex flex-wrap gap-2">
                                {TEST_TYPES.map(t => (
                                    <button key={t.key} onClick={() => setTestType(t.key)}
                                        className={cn("px-3 py-2 rounded-xl border text-xs font-semibold transition whitespace-nowrap",
                                            testType === t.key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50")}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-end gap-3">
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !hasInput}
                                className="px-6 py-2.5 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                {isGenerating ? (
                                    <><span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Generating {TEST_TYPES.find(t => t.key === testType)?.label || testType}...</>
                                ) : (
                                    <>{TEST_TYPES.find(t => t.key === testType)?.buttonLabel || 'Generate API Tests'} <span className="text-blue-200 text-[10px] font-mono hidden sm:inline">({aiLabel})</span></>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {renderAnalysisProgress()}

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="whitespace-pre-line">{error}</span>
                    </div>
                )}

                {/* Main content: 2-column */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Left panel */}
                    <div className="flex flex-col gap-4">
                        {renderInputSection()}

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
                                                'bg-slate-100 text-slate-700')}>
                                                {ep.method}
                                            </span>
                                            <span className="font-mono text-slate-600">{ep.path}</span>
                                            {ep.summary && <span className="text-slate-400 truncate">{ep.summary}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {jiraResult && (
                            <div className={cn("rounded-xl px-4 py-3 text-sm flex items-center gap-2",
                                jiraResult.key ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
                                {jiraResult.key ? (
                                    <>✓ Created <a href={jiraResult.url} target="_blank" rel="noreferrer" className="font-bold underline">{jiraResult.key}</a> in Jira</>
                                ) : (
                                    <span>✕ {jiraResult.error}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right panel */}
                    <div className="flex flex-col gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col" style={{ minHeight: '500px' }}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                            <div>
                                <h2 className="text-sm font-semibold text-slate-800">Generated Test Code</h2>
                                <p className="text-xs text-slate-400">
                                    {generatedCode ? `${generatedCode.split('\n').length} lines` : 'Output will appear here'}
                                </p>
                            </div>
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
                                        {isGenerating ? 'AI is analyzing your API spec and generating tests...' : 'Enter API input (Swagger, cURL, Postman, or raw), then click Generate'}
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

                    {generatedCode && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex gap-3">
                            <button onClick={handleCopy}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50">
                                <Copy className="w-4 h-4" /> Copy
                            </button>
                            <button onClick={handleDownload}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50">
                                <Download className="w-4 h-4" /> Download
                            </button>
                            <button onClick={handleSaveToJira} disabled={savingToJira}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50">
                                {savingToJira
                                    ? <><span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> Saving...</>
                                    : <><Bug className="w-4 h-4" /> Save to Jira</>}
                            </button>
                            <button onClick={handleGenerate} disabled={isGenerating}
                                className="flex items-center justify-center px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {renderExecutionDashboard()}

                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sample Swagger URLs Reference</h3>
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
                                    <button onClick={() => { setSwaggerUrl(api.url); setInputMode('url'); }}
                                        className="text-xs text-blue-600 hover:underline ml-3 whitespace-nowrap">
                                        Use this
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
}
