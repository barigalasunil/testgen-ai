"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileJson, FileSpreadsheet, Play, RefreshCw, Send, Upload, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSavedModel, getSavedProvider, loadProviderSettings } from "@/src/services/ai/ai-config.service";
import { loadJiraCredentials } from "@/src/services/jira/jira.service";
import { exportApiCsv, exportApiExcel, exportApiJson } from "./api-testing-export.service";
import { ApiExecutionResult, ApiFramework, ApiInputMode, ApiTestCase } from "./types";
import { AiProviderId } from "@/src/services/ai/provider-orchestrator";
import { useGlobalProgress } from "@/src/components/shared/ProgressProvider";

export interface ApiTestingWorkspaceProps {
    globalProvider: AiProviderId;
    globalModel: string;
    onProviderChange: (p: AiProviderId) => void;
    onModelChange: (m: string) => void;
}

const inputModes: { key: ApiInputMode; label: string }[] = [
    { key: "swagger-url", label: "Swagger URL" },
    { key: "swagger-upload", label: "OpenAPI Upload" },
    { key: "curl", label: "cURL" },
    { key: "raw", label: "Raw Endpoint" },
    { key: "postman", label: "Postman" },
    { key: "jira", label: "Jira Story" },
];

const frameworks: { key: ApiFramework; label: string }[] = [
    { key: "restassured", label: "Rest Assured" },
    { key: "playwright", label: "Playwright API" },
    { key: "newman", label: "Newman" },
];

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

type ApiSourceSummary = {
    title: string;
    description?: string;
    jiraStoryId?: string;
    endpointCount: number;
    endpoints?: { method: string; endpoint: string; summary?: string }[];
};

function apiTableDescription(testCases: ApiTestCase[]): string {
    const headers = ["Test Case ID", "API Scenario", "Method", "Endpoint", "Preconditions", "Request Data", "Steps", "Expected Status Code", "Expected Result", "Test Type", "Priority"];
    const rows = testCases.map(tc => [
        tc.testCaseId,
        tc.apiScenario,
        tc.method,
        tc.endpoint,
        tc.preconditions,
        tc.requestData,
        tc.steps,
        tc.expectedStatusCode,
        tc.expectedResult,
        tc.testType,
        tc.priority,
    ]);
    const formatRow = (row: string[]) => `| ${row.map(cell => String(cell || "").replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ")} |`;
    return [
        formatRow(headers),
        formatRow(headers.map(() => "---")),
        ...rows.map(formatRow),
    ].join("\n");
}

export function ApiTestingWorkspace({ globalProvider, globalModel }: ApiTestingWorkspaceProps) {
    const { startProgress, updateProgress, stopProgress } = useGlobalProgress();
    const [inputMode, setInputMode] = useState<ApiInputMode>("swagger-url");
    const [framework, setFramework] = useState<ApiFramework>("playwright");
    const [swaggerUrl, setSwaggerUrl] = useState("/saucedemo-api-spec.json");
    const [swaggerJson, setSwaggerJson] = useState("");
    const [curlCommand, setCurlCommand] = useState("");
    const [postmanJson, setPostmanJson] = useState("");
    const [jiraStoryId, setJiraStoryId] = useState("");
    const [rawMethod, setRawMethod] = useState("GET");
    const [rawEndpoint, setRawEndpoint] = useState("");
    const [rawHeaders, setRawHeaders] = useState("");
    const [rawPayload, setRawPayload] = useState("");
    const [testCases, setTestCases] = useState<ApiTestCase[]>([]);
    const [source, setSource] = useState<ApiSourceSummary | null>(null);
    const [automationCode, setAutomationCode] = useState("");
    const [isGeneratingCases, setIsGeneratingCases] = useState(false);
    const [isGeneratingAutomation, setIsGeneratingAutomation] = useState(false);
    const [isPushingJira, setIsPushingJira] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [execution, setExecution] = useState<ApiExecutionResult>({
        status: "idle",
        passed: 0,
        failed: 0,
        total: 0,
        logs: [],
    });

    const hasInput = useMemo(() => {
        if (inputMode === "swagger-url") return Boolean(swaggerUrl.trim());
        if (inputMode === "swagger-upload") return Boolean(swaggerJson.trim());
        if (inputMode === "curl") return Boolean(curlCommand.trim());
        if (inputMode === "postman") return Boolean(postmanJson.trim());
        if (inputMode === "jira") return Boolean(jiraStoryId.trim());
        return Boolean(rawEndpoint.trim());
    }, [inputMode, swaggerUrl, swaggerJson, curlCommand, postmanJson, jiraStoryId, rawEndpoint]);

    const payload = (outputMode: "testcases" | "automation") => ({
        outputMode,
        inputMode,
        swaggerUrl: inputMode === "swagger-url" ? swaggerUrl : null,
        swaggerJson: inputMode === "swagger-upload" ? swaggerJson : null,
        curlCommand: inputMode === "curl" ? curlCommand : null,
        postmanJson: inputMode === "postman" ? postmanJson : null,
        rawMethod: inputMode === "raw" ? rawMethod : null,
        rawEndpoint: inputMode === "raw" ? rawEndpoint : null,
        rawHeaders: inputMode === "raw" ? rawHeaders : null,
        rawPayload: inputMode === "raw" ? rawPayload : null,
        jiraStoryId: inputMode === "jira" ? jiraStoryId : null,
        framework,
        testType: framework,
        provider: globalProvider,
        providerSettings: loadProviderSettings(),
        model: globalModel,
        testCases,
    });

    const handleGenerateCases = async () => {
        if (!hasInput) return;
        setIsGeneratingCases(true);
        startProgress("Analyzing API Source...");
        setError("");
        setNotice("");
        setTestCases([]);
        try {
            updateProgress(30, "Generating Test Cases...");
            const response = await fetch("/api/api-testing/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload("testcases")),
            });
            updateProgress(80, "Parsing Results...");
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || "API test case generation failed");
            setTestCases(data.testCases || []);
            setSource(data.source || null);
            setNotice(`Generated ${(data.testCases || []).length} API test cases`);
            updateProgress(100, "Done");
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsGeneratingCases(false);
            setTimeout(stopProgress, 500);
        }
    };

    const handleGenerateAutomation = async () => {
        if (!hasInput) return;
        setIsGeneratingAutomation(true);
        startProgress(`Generating ${framework} code...`);
        setError("");
        setNotice("");
        setAutomationCode("");
        try {
            updateProgress(40, "Orchestrating AI...");
            const response = await fetch("/api/api-testing/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload("automation")),
            });
            updateProgress(85, "Finalizing Code...");
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || "API automation generation failed");
            setAutomationCode(data.code || "");
            setSource(prev => prev || data.source || null);
            setNotice(`${frameworks.find(item => item.key === framework)?.label} automation generated`);
            updateProgress(100, "Ready to Execute");
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsGeneratingAutomation(false);
            setTimeout(stopProgress, 500);
        }
    };

    const handleExecute = async () => {
        if (!automationCode.trim()) {
            setError("Generate API automation before execution.");
            return;
        }
        setExecution({ status: "running", passed: 0, failed: 0, total: 0, logs: [`Starting ${framework} execution...`] });
        setError("");
        try {
            const response = await fetch("/api/api-testing/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: automationCode, testType: framework }),
            });
            const data = await response.json();
            setExecution({
                status: response.ok && data.success ? "completed" : "failed",
                durationMs: data.durationMs,
                passed: Number(data.passed || 0),
                failed: Number(data.failed || 0),
                total: Number(data.total || 0),
                reportUrl: data.reportUrl,
                message: data.error || data.message,
                logs: [
                    ...(data.output ? String(data.output).split("\n").filter(Boolean) : []),
                    ...(data.error ? [String(data.error)] : []),
                    ...(data.stderr ? String(data.stderr).split("\n").filter(Boolean) : []),
                ].slice(0, 80),
            });
        } catch (err) {
            setExecution({
                status: "failed",
                passed: 0,
                failed: 1,
                total: 1,
                message: err instanceof Error ? err.message : String(err),
                logs: [err instanceof Error ? err.message : String(err)],
            });
        }
    };

    const handlePushToJira = async () => {
        if (!testCases.length) return;
        setIsPushingJira(true);
        setError("");
        setNotice("");
        try {
            const credentials = loadJiraCredentials();
            const storyId = source?.jiraStoryId || jiraStoryId.match(/[A-Z][A-Z0-9]+-\d+/)?.[0] || "";
            const summary = `[API Test Cases] ${source?.title || storyId || "Generated API Coverage"}`;
            const description = [
                "Generated by TCGen-Buddy API Testing Workspace.",
                storyId ? `Linked Requirement Story: ${storyId}` : "",
                "",
                apiTableDescription(testCases).slice(0, 25000),
            ].filter(Boolean).join("\n");
            const response = await fetch("/api/jira/create-issue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    summary,
                    description,
                    issueType: "Task",
                    priority: "Medium",
                    labels: ["api-testing", "tcgen-buddy"],
                    credentials,
                    storyId,
                    traceability: storyId ? { sourceId: storyId, label: "Requirement Story" } : undefined,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || "Push to Jira failed");
            setNotice(`Created ${data.issueKey} in Jira`);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsPushingJira(false);
        }
    };

    const handleFile = async (file: File | undefined, target: "swagger" | "postman") => {
        if (!file) return;
        const text = await file.text();
        if (target === "swagger") setSwaggerJson(text);
        else setPostmanJson(text);
    };

    const automationPanel = (
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">API Automation</h3>
                <div className="flex gap-2">
                    <select value={framework} onChange={e => setFramework(e.target.value as ApiFramework)} className="h-8 rounded border border-gray-200 bg-gray-50 px-2 text-xs font-bold dark:border-gray-700 dark:bg-gray-800">
                        {frameworks.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                    <button onClick={handleGenerateAutomation} disabled={!hasInput || isGeneratingAutomation} className="inline-flex h-8 items-center gap-1.5 rounded bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700">
                        {isGeneratingAutomation ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                        Generate
                    </button>
                    <button onClick={handleExecute} disabled={!automationCode || execution.status === "running"} className="inline-flex h-8 items-center gap-1.5 rounded border border-gray-200 px-3 text-xs font-bold hover:bg-gray-50 dark:border-gray-700">
                        <Play className="h-3 w-3" /> Execute
                    </button>
                </div>
            </div>
            <pre className="max-h-72 overflow-auto bg-slate-950 p-4 text-[10px] leading-relaxed text-slate-100 font-mono">{automationCode || "Automation code will appear here."}</pre>
            <div className="border-t border-gray-200 p-4 dark:border-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", execution.status === "completed" ? "bg-emerald-50 text-emerald-700" : execution.status === "failed" ? "bg-red-50 text-red-700" : execution.status === "running" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500")}>{execution.status}</span>
                        {execution.status !== 'idle' && (
                            <div className="flex gap-3 text-[10px] font-bold uppercase">
                                <span className="text-emerald-600">{execution.passed} Passed</span>
                                <span className="text-red-600">{execution.failed} Failed</span>
                                <span className="text-gray-500">{execution.total} Total</span>
                            </div>
                        )}
                    </div>
                    {execution.reportUrl && (
                        <a href={execution.reportUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase text-blue-600 hover:underline">View Report</a>
                    )}
                </div>
                {execution.logs.length > 0 && (
                    <div className="mt-3 max-h-32 overflow-auto rounded bg-slate-900 p-2 font-mono text-[9px] text-slate-300">
                        {execution.logs.map((log, i) => <div key={i}>{log}</div>)}
                    </div>
                )}
            </div>
        </section>
    );

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8">
            <div className="flex flex-col gap-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#10A37F]">API Testing Workspace</p>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">API test design, automation, and execution</h2>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {notice && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{notice}</span>
                </div>
            )}

            <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
                <div className="space-y-5">
                    {/* SECTION 1: SOURCE */}
                    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1 bg-emerald-500 rounded-full" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">1. Source</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {inputModes.map(mode => (
                                <button
                                    key={mode.key}
                                    onClick={() => setInputMode(mode.key)}
                                    className={cn(
                                        "rounded-lg border px-3 py-2 text-left text-[11px] font-bold transition uppercase",
                                        inputMode === mode.key
                                            ? "border-[#10A37F] bg-[#10A37F]/5 text-[#10A37F]"
                                            : "border-gray-100 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
                                    )}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4">
                            {inputMode === "swagger-url" && (
                                <input value={swaggerUrl} onChange={event => setSwaggerUrl(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950" placeholder="Swagger URL" />
                            )}
                            {inputMode === "swagger-upload" && (
                                <textarea value={swaggerJson} onChange={event => setSwaggerJson(event.target.value)} className="h-32 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950" placeholder="JSON/YAML Spec Content" />
                            )}
                            {inputMode === "curl" && (
                                <textarea value={curlCommand} onChange={event => setCurlCommand(event.target.value)} className="h-32 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950" placeholder="Paste cURL command here" />
                            )}
                            {inputMode === "jira" && (
                                <input value={jiraStoryId} onChange={event => setJiraStoryId(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950" placeholder="Story ID (e.g. TCGB-101)" />
                            )}
                            {inputMode === "raw" && (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <select value={rawMethod} onChange={e => setRawMethod(e.target.value)} className="rounded-lg border bg-gray-50 px-2 py-1 text-xs font-bold">
                                            {methods.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <input value={rawEndpoint} onChange={e => setRawEndpoint(e.target.value)} className="flex-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm" placeholder="Endpoint URL" />
                                    </div>
                                    <textarea value={rawPayload} onChange={e => setRawPayload(e.target.value)} className="h-24 w-full rounded-lg border bg-gray-50 px-3 py-2 font-mono text-xs" placeholder="Payload (Optional)" />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SECTION 2: DISCOVERY */}
                    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-1 bg-blue-500 rounded-full" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">2. Discovery</h3>
                            </div>
                            {source && <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{source.endpointCount} Found</span>}
                        </div>
                        {source ? (
                            <div className="space-y-3">
                                <div className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">Detected endpoints from {source.title}:</div>
                                <div className="max-h-40 overflow-auto border rounded divide-y dark:border-gray-800 dark:divide-gray-800">
                                    {source.endpoints?.slice(0, 10).map((e, i) => (
                                        <div key={i} className="p-2 flex gap-2 text-[10px] font-mono">
                                            <span className="text-blue-600 font-bold w-12">{e.method}</span>
                                            <span className="text-gray-600 dark:text-gray-400 truncate">{e.endpoint}</span>
                                        </div>
                                    ))}
                                    {(source.endpoints?.length || 0) > 10 && <div className="p-2 text-center text-[9px] text-gray-400 uppercase font-bold">... and {(source.endpoints?.length || 0) - 10} more</div>}
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest border border-dashed rounded-lg">No Discovery Data</div>
                        )}
                    </section>

                    {/* SECTION 3: TEST DESIGN */}
                    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-1 bg-purple-500 rounded-full" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">3. Test Design</h3>
                            </div>
                            {testCases.length > 0 && <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{testCases.length} Cases</span>}
                        </div>
                        <button 
                            onClick={handleGenerateCases} 
                            disabled={!hasInput || isGeneratingCases} 
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#10A37F] px-4 py-3 text-[11px] font-bold uppercase text-white shadow-sm hover:shadow-md transition-all hover:translate-y-[-1px] disabled:opacity-50"
                        >
                            {isGeneratingCases ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Generate API Cases
                        </button>
                    </section>

                    {/* SECTION 4: AUTOMATION */}
                    <div className="flex items-center gap-2 mb-2 px-2">
                        <div className="h-4 w-1 bg-orange-500 rounded-full" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white">4. Automation Suite</h3>
                    </div>
                    {automationPanel}
                </div>

                <div className="flex flex-col gap-5">
                    {source && (
                        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{source.title}</h3>
                                    <p className="mt-1 text-xs text-gray-500">{source.endpointCount} endpoint{source.endpointCount === 1 ? "" : "s"} detected{source.jiraStoryId ? ` from ${source.jiraStoryId}` : ""}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => exportApiExcel(testCases, source.jiraStoryId || jiraStoryId)} disabled={!testCases.length} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</button>
                                    <button onClick={() => exportApiCsv(testCases, source.jiraStoryId || jiraStoryId)} disabled={!testCases.length} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"><Download className="h-3.5 w-3.5" /> CSV</button>
                                    <button onClick={() => exportApiJson(testCases, source.jiraStoryId || jiraStoryId)} disabled={!testCases.length} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"><FileJson className="h-3.5 w-3.5" /> JSON</button>
                                    <button onClick={handlePushToJira} disabled={!testCases.length || isPushingJira} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">{isPushingJira ? "Pushing..." : "Push to Jira"}</button>
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Generated API Test Cases</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1200px] text-left text-xs">
                                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                                    <tr>
                                        {["Test Case ID", "API Scenario", "Method", "Endpoint", "Preconditions", "Request Data", "Steps", "Expected Status Code", "Expected Result", "Test Type", "Priority"].map(header => (
                                            <th key={header} className="border-b border-gray-200 p-3 dark:border-gray-800">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {testCases.length ? testCases.map(testCase => (
                                        <tr key={testCase.testCaseId} className="align-top hover:bg-gray-50 dark:hover:bg-white/5">
                                            <td className="border-b border-gray-100 p-3 font-mono font-semibold dark:border-gray-800">{testCase.testCaseId}</td>
                                            <td className="border-b border-gray-100 p-3 font-semibold dark:border-gray-800">{testCase.apiScenario}</td>
                                            <td className="border-b border-gray-100 p-3 font-mono dark:border-gray-800">{testCase.method}</td>
                                            <td className="border-b border-gray-100 p-3 font-mono dark:border-gray-800">{testCase.endpoint}</td>
                                            <td className="border-b border-gray-100 p-3 dark:border-gray-800">{testCase.preconditions}</td>
                                            <td className="border-b border-gray-100 p-3 whitespace-pre-wrap dark:border-gray-800">{testCase.requestData}</td>
                                            <td className="border-b border-gray-100 p-3 whitespace-pre-wrap dark:border-gray-800">{testCase.steps}</td>
                                            <td className="border-b border-gray-100 p-3 font-semibold dark:border-gray-800">{testCase.expectedStatusCode}</td>
                                            <td className="border-b border-gray-100 p-3 dark:border-gray-800">{testCase.expectedResult}</td>
                                            <td className="border-b border-gray-100 p-3 dark:border-gray-800">{testCase.testType}</td>
                                            <td className="border-b border-gray-100 p-3 dark:border-gray-800">{testCase.priority}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={11} className="p-8 text-center text-sm text-gray-500">Generated API test cases will appear here.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
}
