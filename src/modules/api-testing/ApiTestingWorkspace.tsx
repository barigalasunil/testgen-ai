"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileJson, FileSpreadsheet, Play, RefreshCw, Send, Upload, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSavedModel, getSavedProvider, loadProviderSettings } from "@/src/services/ai/ai-config.service";
import { loadJiraCredentials } from "@/src/services/jira/jira.service";
import { exportApiCsv, exportApiExcel, exportApiJson } from "./api-testing-export.service";
import { ApiExecutionResult, ApiFramework, ApiInputMode, ApiTestCase } from "./types";

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

export function ApiTestingWorkspace() {
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
        provider: getSavedProvider(),
        providerSettings: loadProviderSettings(),
        model: getSavedModel(),
        testCases,
    });

    const handleGenerateCases = async () => {
        if (!hasInput) return;
        setIsGeneratingCases(true);
        setError("");
        setNotice("");
        setTestCases([]);
        try {
            const response = await fetch("/api/api-testing/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload("testcases")),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || "API test case generation failed");
            setTestCases(data.testCases || []);
            setSource(data.source || null);
            setNotice(`Generated ${(data.testCases || []).length} API test cases`);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsGeneratingCases(false);
        }
    };

    const handleGenerateAutomation = async () => {
        if (!hasInput) return;
        setIsGeneratingAutomation(true);
        setError("");
        setNotice("");
        setAutomationCode("");
        try {
            const response = await fetch("/api/api-testing/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload("automation")),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || "API automation generation failed");
            setAutomationCode(data.code || "");
            setSource(prev => prev || data.source || null);
            setNotice(`${frameworks.find(item => item.key === framework)?.label} automation generated`);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsGeneratingAutomation(false);
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
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">API Automation</h3>
            </div>
            <pre className="max-h-72 overflow-auto bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">{automationCode || "Generated Rest Assured, Playwright API, or Newman artifacts will appear here."}</pre>
        </section>
    );

    const executionPanel = (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Execution</h3>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", execution.status === "completed" ? "bg-emerald-50 text-emerald-700" : execution.status === "failed" ? "bg-red-50 text-red-700" : execution.status === "running" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500")}>{execution.status.toUpperCase()}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                <span className="text-emerald-600">{execution.passed} passed</span>
                <span className="text-red-600">{execution.failed} failed</span>
                <span className="text-gray-500">{execution.total} total</span>
                {execution.reportUrl && <a href={execution.reportUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Report</a>}
            </div>
            {execution.message && <p className="mt-2 text-sm text-red-600">{execution.message}</p>}
            <div className="mt-3 max-h-44 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-slate-200">
                {execution.logs.length ? execution.logs.map((line, index) => <div key={`${index}-${line.slice(0, 8)}`}>{line}</div>) : "Execution logs will appear here."}
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
                <div className="space-y-4">
                    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">API Input</h3>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            {inputModes.map(mode => (
                                <button
                                    key={mode.key}
                                    onClick={() => setInputMode(mode.key)}
                                    className={cn(
                                        "rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
                                        inputMode === mode.key
                                            ? "border-[#10A37F] bg-[#10A37F]/10 text-[#08785f]"
                                            : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                    )}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 space-y-3">
                            {inputMode === "swagger-url" && (
                                <input value={swaggerUrl} onChange={event => setSwaggerUrl(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="https://example.com/openapi.json" />
                            )}
                            {inputMode === "swagger-upload" && (
                                <>
                                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-4 text-sm font-semibold text-gray-600 hover:border-[#10A37F] dark:border-gray-700 dark:text-gray-300">
                                        <Upload className="h-4 w-4" />
                                        Upload OpenAPI JSON/YAML
                                        <input type="file" accept=".json,.yaml,.yml" className="hidden" onChange={event => handleFile(event.target.files?.[0], "swagger")} />
                                    </label>
                                    <textarea value={swaggerJson} onChange={event => setSwaggerJson(event.target.value)} className="h-36 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="OpenAPI content" />
                                </>
                            )}
                            {inputMode === "curl" && (
                                <textarea value={curlCommand} onChange={event => setCurlCommand(event.target.value)} className="h-32 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder={'curl -X POST https://api.example.com/users -H "Authorization: Bearer ..." -d "{...}"'} />
                            )}
                            {inputMode === "raw" && (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <select value={rawMethod} onChange={event => setRawMethod(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                                            {methods.map(method => <option key={method}>{method}</option>)}
                                        </select>
                                        <input value={rawEndpoint} onChange={event => setRawEndpoint(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="https://api.example.com/resource" />
                                    </div>
                                    <textarea value={rawHeaders} onChange={event => setRawHeaders(event.target.value)} className="h-20 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="Headers" />
                                    <textarea value={rawPayload} onChange={event => setRawPayload(event.target.value)} className="h-24 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="Request body" />
                                </div>
                            )}
                            {inputMode === "postman" && (
                                <>
                                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-4 text-sm font-semibold text-gray-600 hover:border-[#10A37F] dark:border-gray-700 dark:text-gray-300">
                                        <Upload className="h-4 w-4" />
                                        Upload Postman Collection
                                        <input type="file" accept=".json" className="hidden" onChange={event => handleFile(event.target.files?.[0], "postman")} />
                                    </label>
                                    <textarea value={postmanJson} onChange={event => setPostmanJson(event.target.value)} className="h-36 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="Postman collection JSON" />
                                </>
                            )}
                            {inputMode === "jira" && (
                                <input value={jiraStoryId} onChange={event => setJiraStoryId(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#10A37F] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" placeholder="TCGB-123 or Jira URL" />
                            )}
                        </div>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Framework</h3>
                        <div className="mt-3 grid gap-2">
                            {frameworks.map(item => (
                                <button key={item.key} onClick={() => setFramework(item.key)} className={cn("rounded-lg border px-3 py-2 text-left text-xs font-semibold", framework === item.key ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300")}>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="grid gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <button onClick={handleGenerateCases} disabled={!hasInput || isGeneratingCases} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#10A37F] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0d8b6d] disabled:opacity-50">
                            {isGeneratingCases ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Generate API Test Cases
                        </button>
                        <button onClick={handleGenerateAutomation} disabled={!hasInput || isGeneratingAutomation} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                            {isGeneratingAutomation ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            Generate Automation
                        </button>
                        <button onClick={handleExecute} disabled={!automationCode || execution.status === "running"} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                            <Play className="h-4 w-4" />
                            Execute API Tests
                        </button>
                    </section>

                    {automationPanel}
                    {executionPanel}
                </div>

                <div className="space-y-4">
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
