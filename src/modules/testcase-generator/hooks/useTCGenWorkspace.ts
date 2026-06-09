"use client";

import { useState, useEffect, useRef } from "react";
import { HistoryItem, SuiteExecution, SuiteKey, TestCase, AiGenerationOptions, AiGenerationMeta } from "../types";
import { generateTestCases, fetchModels } from "../services";
import { extractJiraId } from "@/src/orchestrators/jira-orchestrator";
import { getSavedModel, saveModel, getSavedProvider, saveProvider } from "@/src/services/ai/ai-config.service";

const AUTO_MODEL = "auto";
const GENERATION_STEPS = [
    'Generating functional scenarios...',
    'Creating negative validations...',
    'Building edge cases...',
    'Formatting export structure...',
];

const initialAutomationState: Record<SuiteKey, SuiteExecution> = {
    smoke: { status: 'idle' },
    sanity: { status: 'idle' },
    regression: { status: 'idle' },
};

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

export function useTCGenWorkspace() {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<HistoryItem[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activePanel, setActivePanel] = useState<'testcases' | 'automation' | 'jira'>('testcases');
    const [generatingPrompt, setGeneratingPrompt] = useState("");
    const [generationModelStatus, setGenerationModelStatus] = useState("Using: Auto");
    const [resultTab, setResultTab] = useState<'testCases' | 'scripts' | 'logs'>('testCases');
    const [activityIndex, setActivityIndex] = useState(0);

    // Feature states
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState(AUTO_MODEL);
    const [provider, setProvider] = useState<'local' | 'cloud' | 'auto'>('local');
    const [providerStatus, setProviderStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [platformType, setPlatformType] = useState<"web" | "mobile" | "api">("web");

    // Automation states
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
    const [automationError, setAutomationError] = useState<string | null>(null);
    const [dashboardAutomation, setDashboardAutomation] = useState<Record<SuiteKey, SuiteExecution>>(initialAutomationState);

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

        loadSessions();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') loadSessions();
        };
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
        fetchModels(provider)
            .then(data => {
                setModels(data.models || []);
                if (selectedModel !== AUTO_MODEL && data.models && !data.models.includes(selectedModel)) {
                    setSelectedModel(AUTO_MODEL);
                }
            })
            .catch(err => console.error("Failed to update models for provider", err));
    }, [provider]);

    useEffect(() => {
        localStorage.setItem("testgen-sessions", JSON.stringify(sessions));
    }, [sessions]);

    useEffect(() => {
        if (!loading) { setActivityIndex(0); return; }
        const interval = window.setInterval(() => {
            setActivityIndex((v) => (v + 1) % GENERATION_STEPS.length);
        }, 2200);
        return () => window.clearInterval(interval);
    }, [loading]);

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
        setScriptCode(activeSession?.generatedScript ?? null);
        setScriptFileName(activeSession?.scriptFileName ?? null);
    }, [activeSession?.generatedScript, activeSession?.scriptFileName]);

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
        const interval = window.setInterval(loadStatus, 20000);
        return () => window.clearInterval(interval);
    }, [provider]);

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
                generatedScript: undefined,
                scriptFileName: undefined,
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
                        generatedScript: undefined,
                        scriptFileName: undefined,
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
            generatedScript: undefined,
            scriptFileName: undefined,
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
        setActivePanel('testcases');
        setValue("");
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleSelectChat = (id: string) => {
        setActiveId(id);
        setActivePanel('testcases');
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

    const handleOpenJira = (testCase: TestCase) => {
        setJiraTargetCase(testCase);
        setJiraModalOpen(true);
    };

    const handleGenerateScript = async () => {
        const currentThread = sessions.find(s => s.id === activeId);
        const testCases = currentThread?.result?.testCases;
        if (!testCases?.length || !activeId) {
            setAutomationError('Generate test cases before creating a Playwright script.');
            return;
        }
        const storyId = currentThread?.aiOptions?.jiraStoryId || '';
        setAutomationError(null);
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
            const generatedCode = payload.code || '';
            const generatedFileName = payload.fileName || 'generated.spec.ts';
            if (!generatedCode.trim()) {
                throw new Error('Script generator returned an empty script.');
            }
            setScriptCode(generatedCode);
            setScriptFileName(generatedFileName);
            setResultTab('scripts');
            setSessions(prev => prev.map(s =>
                s.id === activeId
                    ? { ...s, generatedScript: generatedCode, scriptFileName: generatedFileName, updatedAt: new Date().toISOString() }
                    : s
            ));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setAutomationError(`Script generation failed: ${message}`);
            setExecutionLogs(prev => [...prev, `Script generation failed: ${message}`]);
        } finally {
            setIsGeneratingScript(false);
        }
    };

    const handleRunGeneratedScript = async () => {
        const currentThread = sessions.find(s => s.id === activeId);
        if (!scriptCode || !scriptFileName) {
            setAutomationError('Generate a Playwright script before running automation.');
            return;
        }
        const storyId = currentThread?.aiOptions?.jiraStoryId || '';
        setIsRunningAutomation(true);
        setAutomationError(null);
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
            const response = await fetch('/api/automation/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'generated',
                    scriptFile: scriptFileName,
                    scriptCode,
                    jiraStoryId: storyId,
                    headed,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Automation request failed with HTTP ${response.status}`);
            }

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
            const message = error instanceof Error ? error.message : String(error);
            setAutomationError(`Execution failed: ${message}`);
            addLog(`Execution error: ${message}`);
        } finally {
            setIsRunningAutomation(false);
        }
    };

    const handleExecuteSuite = async (suite: SuiteKey, headed: boolean = false) => {
        const targetId = activeId;
        const startedAt = new Date().toISOString();
        const runningState: SuiteExecution = { status: 'running', lastRunAt: startedAt };

        if (targetId) {
            setSessions(prev => prev.map(s =>
                s.id === targetId
                    ? { ...s, automation: { ...s.automation, [suite]: { ...s.automation[suite], ...runningState } }, updatedAt: startedAt }
                    : s
            ));
        } else {
            setDashboardAutomation(prev => ({ ...prev, [suite]: { ...prev[suite], ...runningState } }));
        }

        try {
            const response = await fetch('/api/automation/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suite, headed }),
            });
            const payload = (await response.json()) as AutomationRunResponse;
            const finishedAt = payload.finishedAt || new Date().toISOString();
            const suiteState: SuiteExecution = {
                status: response.ok && !payload.error ? payload.status : 'failed',
                lastRunAt: finishedAt,
                reportUrl: payload.reportUrl,
                message: payload.message,
                durationMs: payload.durationMs,
                output: payload.output,
                stderr: payload.stderr,
            };

            if (targetId) {
                setSessions(prev => prev.map(s =>
                    s.id === targetId
                        ? {
                            ...s,
                            automation: {
                                ...s.automation,
                                [suite]: suiteState,
                            },
                            reports: payload.reportUrl
                                ? Array.from(new Set([...(s.reports || []), payload.reportUrl]))
                                : s.reports,
                            updatedAt: finishedAt,
                        }
                        : s
                ));
            } else {
                setDashboardAutomation(prev => ({ ...prev, [suite]: suiteState }));
            }
        } catch (error) {
            const finishedAt = new Date().toISOString();
            const failedState = {
                status: 'failed' as const,
                lastRunAt: finishedAt,
                message: error instanceof Error ? error.message : String(error),
            };

            if (targetId) {
                setSessions(prev => prev.map(s =>
                    s.id === targetId
                        ? {
                            ...s,
                            automation: {
                                ...s.automation,
                                [suite]: {
                                    ...s.automation[suite],
                                    ...failedState,
                                },
                            },
                            updatedAt: finishedAt,
                        }
                        : s
                ));
            } else {
                setDashboardAutomation(prev => ({ ...prev, [suite]: { ...prev[suite], ...failedState } }));
            }
        }
    };

    const copyTableData = () => {
        const currentThread = sessions.find(s => s.id === activeId);
        if (!currentThread?.result) return;
        const text = currentThread.result.testCases.map(tc =>
            `ID: ${tc.testCaseId}\nTitle: ${tc.scenarioTitle}\nType: ${tc.testType}\nPriority: ${tc.priority}\nPreconditions: ${tc.preconditions}\nTest Data: ${tc.testData}\nSteps: ${tc.testSteps}\nExpected: ${tc.expectedResult}`
        ).join("\n\n---\n\n");
        navigator.clipboard.writeText(text);
    };

    const handleCopyScript = async () => {
        if (!scriptCode) {
            setAutomationError('No generated script is available to copy.');
            return;
        }
        await navigator.clipboard.writeText(scriptCode);
    };

    const handleDownloadScript = () => {
        if (!scriptCode) {
            setAutomationError('No generated script is available to download.');
            return;
        }
        const blob = new Blob([scriptCode], { type: 'text/typescript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = scriptFileName || 'generated.spec.ts';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return {
        value, setValue,
        loading, setLoading,
        sessions, setSessions,
        activeId, setActiveId,
        isSidebarOpen, setIsSidebarOpen,
        activePanel, setActivePanel,
        generatingPrompt, setGeneratingPrompt,
        generationModelStatus, setGenerationModelStatus,
        resultTab, setResultTab,
        activityIndex, progressLabel: GENERATION_STEPS[activityIndex],
        models, setModels,
        selectedModel, setSelectedModel,
        provider, setProvider,
        providerStatus, setProviderStatus,
        platformType, setPlatformType,
        scriptCode, setScriptCode,
        scriptFileName, setScriptFileName,
        isGeneratingScript, setIsGeneratingScript,
        isRunningAutomation, setIsRunningAutomation,
        executionLogs, setExecutionLogs,
        executionSummary, setExecutionSummary,
        passedTests, setPassedTests,
        failedTests, setFailedTests,
        headed, setHeaded,
        reportUrl, setReportUrl,
        automationError, setAutomationError,
        dashboardAutomation, setDashboardAutomation,
        jiraModalOpen, setJiraModalOpen,
        jiraTargetCase, setJiraTargetCase,
        textareaRef,
        messagesEndRef,
        activeSession,
        currentThread: sessions.find(s => s.id === activeId),
        automationState: (sessions.find(s => s.id === activeId))?.automation ?? dashboardAutomation,
        handleSend,
        handleNewChat,
        handleSelectChat,
        handleRename,
        handleDelete,
        handleOpenJira,
        handleGenerateScript,
        handleRunGeneratedScript,
        handleExecuteSuite,
        copyTableData,
        handleCopyScript,
        handleDownloadScript,
        saveProvider,
        saveModel
    };
}
