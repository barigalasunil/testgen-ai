"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { ChatMessage } from "./ChatMessage";
import { InputBox } from "./InputBox";
import JiraModal from "./JiraModal";
import { RagPanel } from "./RagPanel";
import { JiraPanel } from "./JiraPanel";
import { generateTestCases, fetchModels } from "../services";
import { AiGenerationMeta, AiGenerationOptions, HistoryItem, SuiteKey, TestCase } from "../types";
import { extractJiraId } from "@/src/orchestrators/jira-orchestrator";
import { getSavedModel, saveModel, getSavedProvider, saveProvider } from "@/src/services/ai/ai-config.service";

type AutomationRunResponse = {
    error: boolean;
    suite: SuiteKey;
    status: 'completed' | 'failed';
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    reportUrl: string;
    output?: string;
    stderr?: string;
    message?: string;
};

type GenerateApiResponse = {
    error?: unknown;
    result?: unknown;
    meta?: AiGenerationMeta;
};

type ParsedTestCaseResult = {
    testCases: TestCase[];
    raw?: string;
};

function isParsedTestCaseResult(value: unknown): value is ParsedTestCaseResult {
    return Boolean(
        value &&
        typeof value === 'object' &&
        Array.isArray((value as { testCases?: unknown }).testCases)
    );
}

function hasRawResponse(value: unknown): value is { raw: string } {
    return Boolean(
        value &&
        typeof value === 'object' &&
        typeof (value as { raw?: unknown }).raw === 'string'
    );
}

function generateWorkspaceName(prompt: string): string {
    const cleaned = prompt.trim().toLowerCase();
    const stopWords = ['test', 'testing', 'check', 'verify', 'validate', 'for', 'the', 'a', 'an', 'of', 'and', 'in', 'on', 'with', 'using'];
    const words = cleaned
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.includes(w));
    if (words.length === 0) {
        return `Workspace – ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return words
        .slice(0, 3)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

const GENERATION_STEPS = [
    'Generating functional scenarios...',
    'Creating negative validations...',
    'Building edge cases...',
    'Formatting export structure...',
];

const AUTO_MODEL = "auto";

export function MainApp() {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<HistoryItem[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activePanel, setActivePanel] = useState<'automation' | 'jira' | 'rag'>('automation');
    const [generatingPrompt, setGeneratingPrompt] = useState("");
    const [generationModelStatus, setGenerationModelStatus] = useState("Using: Auto");
    const [resultTab, setResultTab] = useState<'testCases' | 'scripts' | 'logs'>('testCases');
    const [ollamaStatus, setOllamaStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
    const [activityIndex, setActivityIndex] = useState(0);

    // Feature states
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState(AUTO_MODEL);
    const [provider, setProvider] = useState<'local' | 'cloud' | 'auto'>('local');
    const [providerStatus, setProviderStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [platformType, setPlatformType] = useState<"web" | "mobile" | "api">("web");

    // Automation states (lifted from TestCaseTable)
    const [scriptCode, setScriptCode] = useState<string | null>(null);
    const [scriptFileName, setScriptFileName] = useState<string | null>(null);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isRunningAutomation, setIsRunningAutomation] = useState(false);
    const [executionLogs, setExecutionLogs] = useState<string[]>([]);
    const [executionSummary, setExecutionSummary] = useState<{ total: number; passed: number; failed: number; durationMs: number; reportUrl?: string } | null>(null);
    const [passedTests, setPassedTests] = useState<string[]>([]);
    const [failedTests, setFailedTests] = useState<string[]>([]);
    const [headed, setHeaded] = useState(false);
    const [reportUrl, setReportUrl] = useState<string | null>(null);

    // Jira modal states
    const [jiraModalOpen, setJiraModalOpen] = useState(false);
    const [jiraTargetCase, setJiraTargetCase] = useState<TestCase | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const restoredSessionIdRef = useRef<string | null>(null);

    useEffect(() => {
        const loadSessions = () => {
            const saved = localStorage.getItem("testgen-sessions");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved) as HistoryItem[];
                    if (parsed.length > 0) {
                        setSessions(parsed);
                        setActiveId(prev => prev ?? parsed[0].id);
                        if (window.innerWidth >= 768) setIsSidebarOpen(true);
                    }
                } catch { }
            }
        };

        // Load sessions on mount
        loadSessions();

        // Reload sessions when user navigates back to this tab
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') loadSessions();
        };
        // Also reload when window regains focus (e.g. coming back from /api-testing)
        const handleFocus = () => loadSessions();

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        fetchModels()
            .then(data => {
                if (data.models && data.models.length > 0) {
                    setModels(data.models);
                    setSelectedModel(current =>
                        data.models.includes(current) ? current : data.models[0]
                    );
                }
            })
            .catch(err => console.error("Failed to fetch models", err));

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    useEffect(() => {
        const loadInitial = async () => {
            const activeProvider = getSavedProvider();
            setProvider(activeProvider);

            try {
                const data = await fetchModels(activeProvider);
                if (data.models && data.models.length > 0) {
                    setModels(data.models);
                    const savedFromConfig = getSavedModel();
                    const resolved = savedFromConfig !== AUTO_MODEL && data.models.includes(savedFromConfig)
                        ? savedFromConfig
                        : AUTO_MODEL;
                    setSelectedModel(resolved);
                }
            } catch (err) {
                console.error("Failed to fetch models", err);
            }
        };
        loadInitial();
    }, []);

    useEffect(() => {
        // Re-fetch models when provider changes
        fetchModels(provider)
            .then(data => {
                setModels(data.models || []);
                // If auto is selected, stay on auto. If a specific model was selected, check if it exists in new provider
                if (selectedModel !== AUTO_MODEL && data.models && !data.models.includes(selectedModel)) {
                    setSelectedModel(AUTO_MODEL);
                }
            })
            .catch(err => console.error("Failed to update models for provider", err));
    }, [provider]);

    useEffect(() => {
        localStorage.setItem("testgen-sessions", JSON.stringify(sessions));
    }, [sessions]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => { scrollToBottom(); }, [activeId, loading]);
    useEffect(() => { setResultTab('testCases'); }, [activeId]);

    const activeSession = sessions.find((s) => s.id === activeId) || null;
    const activeSessionId = activeSession?.id;

    useEffect(() => {
        if (!activeSessionId || restoredSessionIdRef.current === activeSessionId) return;
        restoredSessionIdRef.current = activeSessionId;

        if (activeSession?.aiOptions) {
            setSelectedModel(activeSession.aiOptions.model);
            setPlatformType(activeSession.aiOptions.platformType as "web" | "mobile" | "api");
            setValue('');
        } else if (activeSession?.platform) {
            setPlatformType(activeSession.platform as "web" | "mobile" | "api");
            setValue('');
        }
    }, [activeSessionId, activeSession]);

    useEffect(() => {
        const loadStatus = async () => {
            setProviderStatus('connecting');
            try {
                const res = await fetch(`/api/health?provider=${provider}`);
                const payload = await res.json();
                setProviderStatus(res.ok && payload.connected ? 'connected' : 'error');
            } catch {
                setProviderStatus('error');
            }
        };
        loadStatus();
        const interval = window.setInterval(loadStatus, 20000); // Check every 20s
        return () => window.clearInterval(interval);
    }, [provider]);

    useEffect(() => {
        if (!loading) { setActivityIndex(0); return; }
        const interval = window.setInterval(() => {
            setActivityIndex((v) => (v + 1) % GENERATION_STEPS.length);
        }, 2200);
        return () => window.clearInterval(interval);
    }, [loading]);

    const progressLabel = GENERATION_STEPS[activityIndex];

    // Removed legacy status labels

    const currentThread = sessions.find(s => s.id === activeId);

    const handleSend = async (overridePrompt?: string, overrideOptions?: Partial<AiGenerationOptions>) => {
        if (loading) return;
        const textToSubmit = typeof overridePrompt === "string" ? overridePrompt : value;
        if (!textToSubmit.trim()) return;

        const currentPrompt = textToSubmit;
        const promptJiraStoryId = extractJiraId(currentPrompt) ?? '';
        const generationOptions: AiGenerationOptions = {
            model: overrideOptions?.model ?? selectedModel,
            platformType: overrideOptions?.platformType ?? platformType,
            customPrompt: overrideOptions?.customPrompt ?? '',
            acceptanceCriteria: overrideOptions?.acceptanceCriteria ?? '',
            jiraStoryId: overrideOptions?.jiraStoryId ?? promptJiraStoryId,
        };

        saveModel(generationOptions.model);

        setGeneratingPrompt(currentPrompt);
        setGenerationModelStatus(
            generationOptions.model === AUTO_MODEL
                ? "Using: Auto (local fallback enabled)"
                : `Using: ${generationOptions.model}`
        );
        setLoading(true);
        setValue("");
        if (textareaRef.current) textareaRef.current.style.height = "52px";

        const targetId = activeId ?? Date.now().toString();
        const now = new Date().toISOString();
        const smartName = generateWorkspaceName(currentPrompt);

        if (!activeId) {
            setActiveId(targetId);
            setSessions(prev => [{
                id: targetId,
                title: smartName,
                prompt: currentPrompt,
                platform: generationOptions.platformType,
                result: null,
                error: null,
                aiOptions: generationOptions,
                aiMeta: {
                    requestedModel: generationOptions.model,
                    message: generationOptions.model === AUTO_MODEL ? "Using: Auto (local fallback enabled)" : `Using: ${generationOptions.model}`,
                },
                automation: {
                    smoke: { status: 'idle' },
                    sanity: { status: 'idle' },
                    regression: { status: 'idle' },
                },
                reports: [],
                createdAt: now,
                updatedAt: now,
            }, ...prev]);
        } else {
            setSessions(prev => prev.map(s =>
                s.id === targetId
                    ? {
                        ...s,
                        prompt: currentPrompt,
                        platform: generationOptions.platformType,
                        result: null,
                        error: null,
                        aiOptions: generationOptions,
                        aiMeta: {
                            requestedModel: generationOptions.model,
                            message: generationOptions.model === AUTO_MODEL ? "Using: Auto (local fallback enabled)" : `Using: ${generationOptions.model}`,
                        },
                        updatedAt: now
                    }
                    : s
            ));
        }

        try {
            const data = await generateTestCases(
                currentPrompt,
                generationOptions.model,
                "functional",
                generationOptions.platformType,
                generationOptions.customPrompt,
                generationOptions.acceptanceCriteria,
                provider,
                generationOptions.jiraStoryId
            ) as GenerateApiResponse;

            if (data.meta?.message) {
                setGenerationModelStatus(data.meta.message);
            }

            const parsedResult = data && !data.error && isParsedTestCaseResult(data.result)
                ? data.result
                : null;

            let parsedError: string | null = null;
            if (data && data.error) {
                parsedError = String(data.result || data.error);
            } else if (data && !data.error && hasRawResponse(data.result)) {
                parsedError = data.result.raw;
            }

            setSessions(prev => prev.map(s =>
                s.id === targetId
                    ? {
                        ...s,
                        prompt: currentPrompt,
                        platform: generationOptions.platformType,
                        result: parsedResult,
                        error: parsedError,
                        aiOptions: generationOptions,
                        aiMeta: data.meta,
                        updatedAt: new Date().toISOString()
                    }
                    : s
            ));
        } catch (error) {
            const msg = "Network Error: " + (error as Error).message;
            setSessions(prev => prev.map(s =>
                s.id === targetId
                    ? {
                        ...s,
                        result: null,
                        error: msg,
                        aiOptions: generationOptions,
                        aiMeta: { requestedModel: generationOptions.model, message: "Generation failed. Retry generation to continue." },
                        updatedAt: new Date().toISOString()
                    }
                    : s
            ));
        } finally {
            setLoading(false);
        }
    };

    const handleNewChat = () => {
        const id = Date.now().toString();
        setSessions(prev => [{
            id,
            title: 'New Workspace',
            prompt: "",
            platform: 'web',
            result: null,
            error: null,
            automation: {
                smoke: { status: 'idle' },
                sanity: { status: 'idle' },
                regression: { status: 'idle' },
            },
            reports: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, ...prev]);
        setActiveId(id);
        setValue("");
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleSelectChat = (id: string) => {
        setActiveId(id);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleRename = (id: string, newTitle: string) => {
        setSessions(prev => prev.map(s =>
            s.id === id ? { ...s, title: newTitle, updatedAt: new Date().toISOString() } : s
        ));
    };

    const handleDelete = (id: string) => {
        setSessions(prev => {
            const updated = prev.filter(s => s.id !== id);
            if (activeId === id) setActiveId(updated[0]?.id ?? null);
            return updated;
        });
        if (activeId === id && window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const copyTableData = () => {
        if (!currentThread?.result) return;
        const text = currentThread.result.testCases.map(tc =>
            `ID: ${tc.testCaseId}\nTitle: ${tc.scenarioTitle}\nType: ${tc.testType}\nPriority: ${tc.priority}\nPreconditions: ${tc.preconditions}\nTest Data: ${tc.testData}\nSteps: ${tc.testSteps}\nExpected: ${tc.expectedResult}`
        ).join("\n\n---\n\n");
        navigator.clipboard.writeText(text);
    };

    // Jira handlers
    const handleOpenJira = (testCase: TestCase) => {
        setJiraTargetCase(testCase);
        setJiraModalOpen(true);
    };

    const handleGenerateScript = async () => {
        const testCases = currentThread?.result?.testCases;
        if (!testCases?.length) return;
        const storyId = currentThread?.aiOptions?.jiraStoryId || '';
        setIsGeneratingScript(true);
        try {
            const response = await fetch('/api/automation/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    testCases,
                    platform: currentThread?.platform || null,
                    jiraStoryId: storyId,
                }),
            });
            const payload = await response.json();
            if (!response.ok || payload.error) throw new Error(payload.message || 'Script generation failed');
            setScriptCode(payload.code || '');
            setScriptFileName(payload.fileName || 'generated.spec.ts');
        } catch (error) {
            console.error('Script generation failed:', error);
        } finally {
            setIsGeneratingScript(false);
        }
    };

    const handleRunGeneratedScript = async () => {
        if (!scriptCode || !scriptFileName) return;
        const storyId = currentThread?.aiOptions?.jiraStoryId || '';
        setIsRunningAutomation(true);
        setExecutionLogs([]);
        setExecutionSummary(null);
        setPassedTests([]);
        setFailedTests([]);
        setReportUrl(null);
        const logs: string[] = [];

        const addLog = (msg: string) => {
            logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
            setExecutionLogs([...logs]);
        };

        try {
            addLog('Launching automation execution...');
            addLog(`Script: ${scriptFileName}`);
            addLog('Validating Playwright environment...');

            const response = await fetch('/api/automation/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'generated',
                    scriptFile: scriptFileName,
                    jiraStoryId: storyId,
                    headed,
                }),
            });

            addLog('Execution started...');

            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('__RESULT__:')) {
                            try {
                                const data = JSON.parse(line.slice('__RESULT__:'.length));
                                if (data.type === 'summary') {
                                    setExecutionSummary(data);
                                    if (data.reportUrl) setReportUrl(data.reportUrl);
                                    if (data.failed > 0) {
                                        addLog(`✕ ${data.failed} failed, ${data.passed} passed — ${data.total} total`);
                                    } else {
                                        addLog(`✓ All ${data.passed} tests passed`);
                                    }
                                } else if (data.type === 'passed') {
                                    setPassedTests(data.tests);
                                } else if (data.type === 'failed') {
                                    setFailedTests(data.tests);
                                }
                            } catch {}
                        } else {
                            addLog(line);
                        }
                    }
                }
            }
        } catch (error) {
            addLog(`✕ Execution error: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsRunningAutomation(false);
        }
    };

    const handleExecuteSuite = async (suite: SuiteKey, headed: boolean = false) => {
        if (!activeId) return;
        const startedAt = new Date().toISOString();
        setSessions(prev => prev.map(s =>
            s.id === activeId
                ? { ...s, automation: { ...s.automation, [suite]: { ...s.automation[suite], status: 'running', lastRunAt: startedAt } }, updatedAt: startedAt }
                : s
        ));

        try {
            const response = await fetch('/api/automation/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suite, headed }),
            });
            const payload = (await response.json()) as AutomationRunResponse;
            const finishedAt = payload.finishedAt || new Date().toISOString();

            setSessions(prev => prev.map(s =>
                s.id === activeId
                    ? {
                        ...s,
                        automation: {
                            ...s.automation,
                            [suite]: {
                                status: response.ok && !payload.error ? payload.status : 'failed',
                                lastRunAt: finishedAt,
                                reportUrl: payload.reportUrl,
                                message: payload.message,
                                durationMs: payload.durationMs,
                                output: payload.output,
                                stderr: payload.stderr,
                            },
                        },
                        reports: payload.reportUrl
                            ? Array.from(new Set([...(s.reports || []), payload.reportUrl]))
                            : s.reports,
                        updatedAt: finishedAt,
                    }
                    : s
            ));
        } catch (error) {
            const finishedAt = new Date().toISOString();
            setSessions(prev => prev.map(s =>
                s.id === activeId
                    ? {
                        ...s,
                        automation: {
                            ...s.automation,
                            [suite]: {
                                ...s.automation[suite],
                                status: 'failed',
                                lastRunAt: finishedAt,
                                message: error instanceof Error ? error.message : String(error),
                            },
                        },
                        updatedAt: finishedAt,
                    }
                    : s
            ));
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
            <Sidebar
                history={sessions}
                activeId={activeId}
                activePanel={activePanel}
                onChangePanel={(p) => setActivePanel(p)}
                onSelect={handleSelectChat}
                onNewChat={handleNewChat}
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                loading={loading}
                onRename={handleRename}
                onDelete={handleDelete}
                automation={currentThread?.automation}
                onExecuteSuite={handleExecuteSuite}
                hasTestCases={!!(currentThread?.result?.testCases?.length)}
                scriptCode={scriptCode}
                isGeneratingScript={isGeneratingScript}
                isRunningAutomation={isRunningAutomation}
                executionLogs={executionLogs}
                executionSummary={executionSummary}
                passedTests={passedTests}
                failedTests={failedTests}
                headed={headed}
                onHeadedChange={setHeaded}
                reportUrl={reportUrl}
                onGenerateScript={handleGenerateScript}
                onRunAutomation={handleRunGeneratedScript}
                platformType={platformType}
            />

            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 shadow-sm z-10 min-h-[52px]">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">AI QA Copilot</p>
                        <h1 className="text-lg font-semibold text-slate-900">TCGen-Buddy</h1>
                    </div>

                    <div className="hidden sm:flex items-center gap-3">
                        {/* Provider toggle — shows all three options */}
                        <div className="flex p-0.5 bg-slate-100 rounded-lg">
                            {(['local', 'auto', 'cloud'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => {
                                        if (p === 'auto') return; // auto is informational
                                        setProvider(p);
                                        saveProvider(p);
                                    }}
                                    className={cn(
                                        "px-3 py-1 text-[11px] font-bold rounded-md transition-all",
                                        provider === p
                                            ? "bg-emerald-500 text-white shadow-sm shadow-emerald-300"
                                            : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {p === 'auto' ? 'AUTO' : p.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {/* Connection indicator */}
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all",
                            providerStatus === 'connected' ? "bg-emerald-50 text-emerald-700" :
                                providerStatus === 'error' ? "bg-red-50 text-red-700" :
                                    "bg-amber-50 text-amber-700"
                        )}>
                            <span className={cn(
                                "h-2 w-2 rounded-full",
                                providerStatus === 'connected' ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" :
                                    providerStatus === 'error' ? "bg-red-500" :
                                        "bg-amber-500 animate-pulse"
                            )} />
                            {providerStatus === 'connected' ? 'Connected' :
                                providerStatus === 'error' ? 'Offline' : 'Connecting...'}
                        </div>

                        {/* Model selector — hidden when provider is cloud */}
                        {provider !== 'cloud' && (
                            <select
                                value={selectedModel}
                                onChange={(e) => { setSelectedModel(e.target.value); saveModel(e.target.value); }}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                                <option value="auto">Auto (Recommended)</option>
                                {models.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        )}

                        {/* Cloud model shows the selected model name */}
                        {provider === 'cloud' && (
                            <span className="text-[11px] text-slate-500 font-mono max-w-[120px] truncate">
                                Cloud model: {selectedModel === 'auto' ? 'Auto-Select' : selectedModel}
                            </span>
                        )}

                        {provider !== 'cloud' && selectedModel !== 'auto' && (
                            <span className="text-[10px] text-slate-400 font-mono max-w-[120px] truncate">
                                {selectedModel}
                            </span>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 min-h-0 overflow-hidden">

                    {/* Automation area */}
                    <div className={cn("flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden", activePanel !== 'automation' && 'hidden')}>
                        <section className="flex-1 min-h-0 overflow-y-auto px-4 py-4 lg:px-6">
                            <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-6">
                                {currentThread?.prompt ? (
                                    <ChatMessage role="user" content={currentThread.prompt} />
                                ) : (
                                    <div className="min-h-[220px] flex items-center justify-center text-slate-400 text-sm">
                                        Describe a feature to generate test cases...
                                    </div>
                                )}

                                {currentThread && (currentThread.result || currentThread.error) && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span className="font-medium capitalize text-slate-700">{currentThread.platform}</span>
                                                <span className={cn('rounded-full px-2.5 py-1 font-medium',
                                                    currentThread.error ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                                )}>
                                                    {currentThread.error ? 'Error' : 'Ready'}
                                                </span>
                                                {currentThread.aiMeta?.message && (
                                                    <span className={cn(
                                                        'rounded-full border px-2.5 py-1 font-medium',
                                                        currentThread.aiMeta.fallbackUsed
                                                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                            : 'border-slate-200 bg-white text-slate-600'
                                                    )}>
                                                        {currentThread.aiMeta.message}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {(['testCases', 'scripts', 'logs'] as const).map((tab) => (
                                                    <button key={tab} onClick={() => setResultTab(tab)}
                                                        className={cn('rounded-full px-3 py-1.5 text-xs font-semibold transition',
                                                            resultTab === tab ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                        )}>
                                                        {tab === 'testCases' ? 'Test Cases' : tab === 'scripts' ? 'Scripts' : 'Logs'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {resultTab === 'testCases' && currentThread.result && (
                                            <ChatMessage
                                                role="assistant"
                                                isTable
                                                tableData={currentThread.result}
                                                jiraStoryId={currentThread.aiOptions?.jiraStoryId || ''}
                                                platformType={currentThread.platform}
                                                onCopy={copyTableData}
                                                onRegenerate={() => handleSend(currentThread.prompt, currentThread.aiOptions)}
                                                onOpenJira={handleOpenJira}
                                            />
                                        )}

                                        {resultTab === 'scripts' && (
                                            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                                                {scriptCode ? (
                                                    <div className="space-y-3">
                                                        <p className="text-slate-500 text-xs">Generated script for the current workspace.</p>
                                                        <pre className="whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200 overflow-auto max-h-[420px]">{scriptCode}</pre>
                                                        {scriptFileName && <p className="text-xs text-slate-500">Filename: {scriptFileName}</p>}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <p className="text-slate-500 text-sm">No generated script available yet.</p>
                                                        <p className="text-slate-500 text-xs">Open the Automation Workspace and generate a script from the current test cases.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {resultTab === 'logs' && (
                                            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                                                {executionLogs.length > 0 ? (
                                                    <div className="space-y-3">
                                                        <p className="text-slate-500 text-xs">Execution logs from the last automation run.</p>
                                                        <pre className="whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs text-emerald-200 border border-slate-800 overflow-auto max-h-[420px]">{executionLogs.join("\n")}</pre>
                                                    </div>
                                                ) : currentThread.error ? (
                                                    <div className="space-y-3">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <p className="text-sm text-slate-600">Generation failed. Retry uses the same prompt, model mode, platform, Jira ID, and advanced options.</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => currentThread.prompt && handleSend(currentThread.prompt, currentThread.aiOptions)}
                                                                disabled={loading || !currentThread.prompt}
                                                                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                Retry Generation
                                                            </button>
                                                        </div>
                                                        <pre className="whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200 overflow-auto max-h-96">{currentThread.error}</pre>
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-500 text-sm">No execution logs yet. Run automation to capture logs here.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </section>

                        {/* Input bar */}
                        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-slate-50/95 backdrop-blur-sm px-4 py-4 shadow-inner">
                            {loading && (
                                <div className="mx-auto mb-3 flex max-w-5xl items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                                    <div className="flex items-center gap-1.5">
                                        {[0, 150, 300].map(d => (
                                            <span key={d} className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: `${d}ms` }} />
                                        ))}
                                    </div>
                                    <span className="font-medium">{progressLabel}</span>
                                    <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 sm:inline-flex">
                                        {generationModelStatus}
                                    </span>
                                    {generatingPrompt && (
                                        <span className="ml-auto hidden max-w-[40%] truncate text-xs text-slate-400 sm:block">{generatingPrompt}</span>
                                    )}
                                </div>
                            )}
                            <InputBox
                                value={value}
                                onChange={setValue}
                                onSend={handleSend}
                                disabled={loading}
                                inputRef={textareaRef}
                                platformType={platformType}
                                setPlatformType={setPlatformType}
                            />
                        </div>
                    </div>

                    {activePanel === 'jira' && (
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <JiraPanel />
                        </div>
                    )}
                    {activePanel === 'rag' && (
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <RagPanel />
                        </div>
                    )}
                </div>
            </main>

            {/* Jira Modal */}
            <JiraModal
                isOpen={jiraModalOpen}
                onClose={() => setJiraModalOpen(false)}
                testCase={jiraTargetCase}
                requirementId={currentThread?.aiOptions?.jiraStoryId || undefined}
            />

        </div>
    );
}
