"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { ChatMessage } from "./ChatMessage";
import { InputBox } from "./InputBox";
import { AutomationDashboard } from "./AutomationDashboard";
import JiraModal from "./JiraModal";
import { generateTestCases, fetchModels } from "../services";
import { AiGenerationMeta, AiGenerationOptions, HistoryItem, SuiteKey, TestCase } from "../types";
import {
    saveJiraCredentials,
    loadJiraCredentials,
    testConnection,
} from "@/src/services/jira/jira.service";

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
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [generatingPrompt, setGeneratingPrompt] = useState("");
    const [generationModelStatus, setGenerationModelStatus] = useState("Using: Auto");
    const [resultTab, setResultTab] = useState<'testCases' | 'scripts' | 'logs'>('testCases');
    const [ollamaStatus, setOllamaStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
    const [activityIndex, setActivityIndex] = useState(0);
    const handleStoryLoaded = (story: { summary: string; description: string; storyId: string }) => {
    setValue(
        `Generate test cases for this Jira story:\n\nSummary: ${story.summary}\n\nDescription: ${story.description}`
    );
    if (story.description?.trim()) {
        setAcceptanceCriteria(story.description.slice(0, 500));
    }
    };

    // Feature states
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState(AUTO_MODEL);
    const [isJiraMode, setIsJiraMode] = useState(false);
    const [platformType, setPlatformType] = useState<"web" | "mobile" | "api">("web");
    const [customPrompt, setCustomPrompt] = useState("");
    const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
    const [jiraStoryId, setJiraStoryId] = useState("");

    // Jira modal states
    const [jiraModalOpen, setJiraModalOpen] = useState(false);
    const [jiraTargetCase, setJiraTargetCase] = useState<TestCase | null>(null);

    // Jira settings states
    const [jiraFields, setJiraFields] = useState({
        baseUrl: '',
        email: '',
        apiToken: '',
        projectKey: 'TCGB',
    });
    const [jiraConnStatus, setJiraConnStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
    const [jiraConnMsg, setJiraConnMsg] = useState('');
    const [jiraConnTesting, setJiraConnTesting] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const restoredSessionIdRef = useRef<string | null>(null);

    // Load sessions + models + jira creds on mount
    useEffect(() => {
        const saved = localStorage.getItem("testgen-sessions");
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as HistoryItem[];
                setSessions(parsed);
                if (parsed.length > 0) {
                    setActiveId(parsed[0].id);
                    if (window.innerWidth >= 768) setIsSidebarOpen(true);
                }
            } catch { }
        }

        // Load saved Jira credentials
        const savedCreds = loadJiraCredentials();
        if (savedCreds) setJiraFields(savedCreds);

        fetchModels()
            .then(data => {
                if (data.models && data.models.length > 0) {
                    setModels(data.models);
                    setSelectedModel(current =>
                        current === AUTO_MODEL || data.models.includes(current) ? current : AUTO_MODEL
                    );
                }
            })
            .catch(err => console.error("Failed to fetch models", err));
    }, []);

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
            setPlatformType(activeSession.aiOptions.platformType);
            setCustomPrompt(activeSession.aiOptions.customPrompt || '');
            setAcceptanceCriteria(activeSession.aiOptions.acceptanceCriteria || '');
            setJiraStoryId(activeSession.aiOptions.jiraStoryId || '');
            setValue('');
        } else if (activeSession?.platform) {
            setPlatformType(activeSession.platform);
            setValue('');
        }
    }, [activeSessionId, activeSession]);

    useEffect(() => {
        const loadStatus = async () => {
            try {
                const health = await fetch('/api/health');
                const payload = await health.json();
                setOllamaStatus(health.ok && payload.connected ? 'connected' : 'offline');
            } catch {
                setOllamaStatus('offline');
            }
        };
        loadStatus();
        const interval = window.setInterval(loadStatus, 15000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!loading) { setActivityIndex(0); return; }
        const interval = window.setInterval(() => {
            setActivityIndex((v) => (v + 1) % GENERATION_STEPS.length);
        }, 2200);
        return () => window.clearInterval(interval);
    }, [loading]);

    const progressLabel = GENERATION_STEPS[activityIndex];

    const statusLabel = ollamaStatus === 'connected'
        ? 'Ollama Connected'
        : ollamaStatus === 'connecting'
            ? 'Connecting...'
            : 'Ollama Offline';

    const statusColor = ollamaStatus === 'connected'
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : ollamaStatus === 'offline'
            ? 'bg-red-100 text-red-700 border-red-200'
            : 'bg-amber-100 text-amber-700 border-amber-200';

    const currentThread = sessions.find(s => s.id === activeId);

    const handleSend = async (overridePrompt?: string, overrideOptions?: Partial<AiGenerationOptions>) => {
        if (loading) return;
        const textToSubmit = typeof overridePrompt === "string" ? overridePrompt : value;
        if (!textToSubmit.trim()) return;

        const currentPrompt = textToSubmit;
        const generationOptions: AiGenerationOptions = {
            model: overrideOptions?.model ?? selectedModel,
            platformType: overrideOptions?.platformType ?? platformType,
            customPrompt: overrideOptions?.customPrompt ?? customPrompt,
            acceptanceCriteria: overrideOptions?.acceptanceCriteria ?? acceptanceCriteria,
            jiraStoryId: overrideOptions?.jiraStoryId ?? jiraStoryId,
        };

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
                currentPrompt, generationOptions.model, "functional",
                generationOptions.platformType, generationOptions.customPrompt, generationOptions.acceptanceCriteria
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
            `ID: ${tc.testCaseId}\nTitle: ${tc.title}\nType: ${tc.testType}\nPriority: ${tc.priority}\nPreconditions: ${tc.preconditions}\nTest Data: ${tc.testData}\nSteps: ${tc.steps}\nExpected: ${tc.expectedResult}`
        ).join("\n\n---\n\n");
        navigator.clipboard.writeText(text);
    };

    // Jira handlers
    const handleOpenJira = (testCase: TestCase) => {
        setJiraTargetCase(testCase);
        setJiraModalOpen(true);
    };

    const handleTestJiraConnection = async () => {
        setJiraConnTesting(true);
        setJiraConnStatus('idle');
        try {
            const result = await testConnection(jiraFields);
            if (result.success) {
                setJiraConnStatus('ok');
                setJiraConnMsg(`✓ Connected as ${result.displayName}`);
            } else {
                setJiraConnStatus('fail');
                setJiraConnMsg(`✕ ${result.error}`);
            }
        } catch {
            setJiraConnStatus('fail');
            setJiraConnMsg(`✕ Connection failed`);
        } finally {
            setJiraConnTesting(false);
        }
    };

    const handleSaveJiraCredentials = () => {
        saveJiraCredentials(jiraFields);
        setIsSettingsOpen(false);
        setJiraConnStatus('idle');
    };

    const handleExecuteSuite = async (suite: SuiteKey) => {
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
                body: JSON.stringify({ suite }),
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
                onSelect={handleSelectChat}
                onNewChat={handleNewChat}
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                loading={loading}
                onRename={handleRename}
                onDelete={handleDelete}
            />

            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 shadow-sm z-10">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">AI QA Copilot</p>
                        <h1 className="text-lg font-semibold text-slate-900">TCGen-Buddy</h1>
                        <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">Generate test cases, export artifacts, and run automation suites.</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-sm">
                        <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium", statusColor)}>
                            <span className={cn("h-2.5 w-2.5 rounded-full", ollamaStatus === 'connected' ? 'bg-emerald-500' : ollamaStatus === 'offline' ? 'bg-red-500' : 'bg-amber-500')} />
                            {statusLabel}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 min-h-0 overflow-hidden">

                    {/* Chat area */}
                    <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
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
                                                jiraStoryId={currentThread.aiOptions?.jiraStoryId || jiraStoryId}
                                                platformType={currentThread.platform}
                                                onCopy={copyTableData}
                                                onRegenerate={() => handleSend(currentThread.prompt, currentThread.aiOptions)}
                                                onOpenJira={handleOpenJira}
                                            />
                                        )}

                                        {resultTab === 'scripts' && (
                                            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                                                <p className="text-slate-500 text-xs">Generate scripts from the Test Cases tab.</p>
                                            </div>
                                        )}

                                        {resultTab === 'logs' && (
                                            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                                                {currentThread.error ? (
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
                                                    <p className="text-slate-500 text-sm">No errors were captured.</p>
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
                                value={value} onChange={setValue} onSend={handleSend}
                                disabled={loading} inputRef={textareaRef} models={models}
                                selectedModel={selectedModel} setSelectedModel={setSelectedModel}
                                isJiraMode={isJiraMode} setIsJiraMode={setIsJiraMode}
                                platformType={platformType} setPlatformType={setPlatformType}
                                customPrompt={customPrompt} setCustomPrompt={setCustomPrompt}
                                acceptanceCriteria={acceptanceCriteria} setAcceptanceCriteria={setAcceptanceCriteria}
                                jiraStoryId={jiraStoryId} setJiraStoryId={setJiraStoryId} onStoryLoaded={handleStoryLoaded}
                            />
                        </div>
                    </div>

                    {/* Automation sidebar */}
                    <aside className="hidden xl:flex h-full w-[340px] min-w-[340px] max-w-[340px] flex-shrink-0 flex-col overflow-y-auto overflow-x-hidden border-l border-slate-200 bg-white p-3">
                        <AutomationDashboard
                            automation={currentThread?.automation}
                            onExecuteSuite={handleExecuteSuite}
                            compact
                        />
                    </aside>
                </div>
            </main>

            {/* Jira Modal */}
            <JiraModal
                isOpen={jiraModalOpen}
                onClose={() => setJiraModalOpen(false)}
                testCase={jiraTargetCase}
            />

            {/* Settings Modal */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden"
                        >
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Settings className="w-4 h-4" /> Jira Integration Settings
                                </h2>
                                <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-gray-900">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-5 flex flex-col gap-4">
                                {[
                                    { label: "Jira Base URL", key: "baseUrl", type: "text", placeholder: "https://yourcompany.atlassian.net" },
                                    { label: "Email", key: "email", type: "text", placeholder: "name@company.com" },
                                    { label: "API Token", key: "apiToken", type: "password", placeholder: "••••••••••••••••" },
                                    { label: "Project Key", key: "projectKey", type: "text", placeholder: "TCGB" },
                                ].map(field => (
                                    <div key={field.key}>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                                        <input
                                            type={field.type}
                                            placeholder={field.placeholder}
                                            value={jiraFields[field.key as keyof typeof jiraFields]}
                                            onChange={e => setJiraFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10A37F]/50"
                                        />
                                    </div>
                                ))}

                                {jiraConnStatus !== 'idle' && (
                                    <div className={cn(
                                        'rounded-md px-3 py-2 text-sm font-medium',
                                        jiraConnStatus === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                                    )}>
                                        {jiraConnMsg}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
                                <button
                                    onClick={handleTestJiraConnection}
                                    disabled={jiraConnTesting}
                                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                                >
                                    {jiraConnTesting ? 'Testing...' : 'Test Connection'}
                                </button>
                                <button
                                    onClick={handleSaveJiraCredentials}
                                    className="bg-[#10A37F] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-600 transition-colors"
                                >
                                    Save Credentials
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
