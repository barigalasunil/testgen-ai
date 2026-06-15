"use client";

import { useState, useEffect, useRef } from "react";
import { AutomationExecutionSummary, AutomationRunRecord, AutomationTarget, HistoryItem, SuiteExecution, SuiteKey, TestCase, AiGenerationOptions, AiGenerationMeta, WorkspacePanel, WorkspaceSectionHeader } from "../types";
import { generateTestCases, fetchModels } from "../services";
import { extractJiraId } from "@/src/orchestrators/jira-orchestrator";
import { getSavedModel, saveModel, getSavedProvider, saveProvider, loadProviderSettings } from "@/src/services/ai/ai-config.service";
import { AiProviderId, ProviderSettings } from "@/src/services/ai/provider-orchestrator";
import {
    buildMemoryContextBlock,
    MemoryVaultRecord,
    normalizeProjectKey,
    projectKeyFromText,
    upsertMemoryVaultRecord,
} from "@/src/services/memory-vault/memory-vault.service";

const AUTO_MODEL = "auto";
const GENERATION_STEPS = [
    { label: 'Fetching Jira story...', percent: 10, jiraOnly: true },
    { label: 'Analyzing requirement...', percent: 25 },
    { label: 'Chunking requirement...', percent: 38 },
    { label: 'Generating chunk-wise test cases...', percent: 58 },
    { label: 'Merging test cases...', percent: 76 },
    { label: 'Removing duplicates...', percent: 90 },
    { label: 'Formatting results...', percent: 100 },
];

const SECTION_HEADERS: Record<WorkspacePanel, WorkspaceSectionHeader> = {
    testcases: {
        title: "Test Case Generation",
        subtitle: "Generate test cases from requirements.",
    },
    "api-testing": {
        title: "API Testing",
        subtitle: "Generate, automate, and execute API test scenarios.",
    },
    automation: {
        title: "Automation Hub",
        subtitle: "Manage and execute automation suites.",
    },
    "defect-studio": {
        title: "Defect Studio",
        subtitle: "Create, review, and publish defects to Jira.",
    },
    jira: {
        title: "Settings",
        subtitle: "Manage AI providers and Jira configuration.",
    },
    "memory-vault": {
        title: "Memory Vault",
        subtitle: "Store and reuse project knowledge for generation.",
    },
};

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
    success?: boolean;
    error: boolean;
    suite: SuiteKey;
    status: 'passed' | 'failed' | 'partial_success' | 'error' | 'completed' | 'blocked';
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    targetUrl?: string;
    browser?: string;
    mode?: 'Headed' | 'Headless';
    logs?: string[];
    reportUrl?: string | null;
    playwrightReportUrl?: string | null;
    allureReportUrl?: string | null;
    healingReportUrl?: string | null;
    logUrl?: string | null;
    runId?: string;
    total?: number;
    passed?: number;
    failed?: number;
    failedTests?: string[];
    errors?: AutomationRunRecord['errors'];
    output?: string;
    stderr?: string;
    message?: string;
};

type AutomationToast = {
    id: string;
    type: 'success' | 'failed' | 'error' | 'warning' | 'partial_success';
    message: string;
    reportUrl?: string | null;
    persistent: boolean;
};

type GenerateApiResponse = {
    success?: boolean;
    error?: unknown;
    result?: unknown;
    meta?: AiGenerationMeta;
};

type GenerationError = Error & {
    status?: number;
    payload?: {
        error?: unknown;
        message?: unknown;
        result?: unknown;
        code?: string;
        meta?: AiGenerationMeta;
    };
};

type AttachedDocument = {
    name: string;
    type: string;
    text?: string;
};

type ProviderStatusInfo = {
    connected: boolean;
    status: 'connecting' | 'connected' | 'error' | 'fallback';
    message: string;
    providerUsed?: string;
    model?: string;
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

function extractTargetUrl(text: string): string | undefined {
    const match = text.match(/https?:\/\/[^\s"'<>),]+/i);
    return match?.[0]?.replace(/[.,;:]+$/, '');
}

function buildAutomationTarget(session: {
    id: string;
    title?: string;
    prompt: string;
    aiOptions?: AiGenerationOptions;
    result?: { testCases: TestCase[] } | null;
    scriptFileName?: string;
    automationTarget?: AutomationTarget;
}): AutomationTarget {
    const existingUrl = session.automationTarget?.targetUrl;
    const promptUrl = extractTargetUrl(session.prompt);
    const targetUrl = existingUrl || promptUrl;
    return {
        sessionId: session.id,
        jiraStoryId: session.aiOptions?.jiraStoryId,
        sessionTitle: session.title,
        targetUrl,
        targetUrlSource: existingUrl
            ? session.automationTarget?.targetUrlSource || 'manual_session'
            : promptUrl
                ? 'jira_story'
                : undefined,
        generatedTestCaseIds: session.result?.testCases?.map(testCase => testCase.testCaseId) || [],
        generatedScriptPath: session.scriptFileName,
        latestRunId: session.automationTarget?.latestRunId,
    };
}

export function useTCGenWorkspace() {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<HistoryItem[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activePanel, setActivePanel] = useState<WorkspacePanel>('testcases');
    const [currentSectionHeader, setCurrentSectionHeader] = useState<WorkspaceSectionHeader>(SECTION_HEADERS.testcases);
    const [generatingPrompt, setGeneratingPrompt] = useState("");
    const [generationModelStatus, setGenerationModelStatus] = useState("Using: Auto");
    const [activityIndex, setActivityIndex] = useState(0);
    const [generationHasJira, setGenerationHasJira] = useState(false);
    const [generationFailed, setGenerationFailed] = useState(false);

    // Feature states
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState(AUTO_MODEL);
    const [provider, setProvider] = useState<AiProviderId>('auto');
    const [providerSettings, setProviderSettings] = useState<ProviderSettings>(() => loadProviderSettings());
    const [providerStatus, setProviderStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [providerStatusInfo, setProviderStatusInfo] = useState<ProviderStatusInfo>({
        connected: false,
        status: 'connecting',
        message: 'Checking provider...',
    });
    const [platformType, setPlatformType] = useState<"web" | "mobile" | "api">("web");
    const [attachedDocuments, setAttachedDocuments] = useState<AttachedDocument[]>([]);
    const [attachedMemoryContext, setAttachedMemoryContext] = useState<MemoryVaultRecord | null>(null);

    // Automation states
    const [scriptCode, setScriptCode] = useState<string | null>(null);
    const [scriptFileName, setScriptFileName] = useState<string | null>(null);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isRunningAutomation, setIsRunningAutomation] = useState(false);
    const [executionLogs, setExecutionLogs] = useState<string[]>([]);
    const [executionSummary, setExecutionSummary] = useState<AutomationExecutionSummary | null>(null);
    const [passedTests, setPassedTests] = useState<string[]>([]);
    const [failedTests, setFailedTests] = useState<string[]>([]);
    const [headed, setHeaded] = useState(false);
    const [reportUrl, setReportUrl] = useState<string | null>(null);
    const [automationError, setAutomationError] = useState<string | null>(null);
    const [dashboardAutomation, setDashboardAutomation] = useState<Record<SuiteKey, SuiteExecution>>(initialAutomationState);
    const [automationToast, setAutomationToast] = useState<AutomationToast | null>(null);

    // Jira modal states
    const [jiraModalOpen, setJiraModalOpen] = useState(false);
    const [jiraTargetCase, setJiraTargetCase] = useState<TestCase | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const restoredSessionIdRef = useRef<string | null>(null);
    const providerFailureCountRef = useRef(0);

    const focusAutomationLogs = () => {
        setActivePanel('automation');
        setTimeout(() => {
            document.getElementById('automation-execution-logs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    };

    const showAutomationToast = (toast: Omit<AutomationToast, 'id'>) => {
        const nextToast = { ...toast, id: Date.now().toString() };
        setAutomationToast(nextToast);
        if (!nextToast.persistent) {
            setTimeout(() => {
                setAutomationToast(current => current?.id === nextToast.id ? null : current);
            }, 4500);
        }
    };

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
                const chatModels = data.chatModels || data.models || [];
                if (chatModels.length > 0) {
                    setModels(chatModels);
                    setSelectedModel(current =>
                        chatModels.includes(current) ? current : chatModels[0]
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
            const activeSettings = loadProviderSettings();
            setProvider(activeProvider);
            setProviderSettings(activeSettings);

            try {
                const data = await fetchModels(activeProvider, activeSettings.ollamaBaseUrl);
                const installedModels = data.chatModels || data.models || [];
                setModels(installedModels);

                if (activeProvider === 'ollama' && installedModels.length > 0) {
                    const savedFromConfig = getSavedModel();
                    const modelValid = savedFromConfig !== AUTO_MODEL && installedModels.includes(savedFromConfig);
                    if (modelValid) {
                        setSelectedModel(savedFromConfig);
                    } else {
                        const fallback = installedModels[0];
                        setSelectedModel(fallback);
                        saveModel(fallback);
                    }
                } else if (activeProvider !== 'ollama') {
                    setSelectedModel(AUTO_MODEL);
                }
            } catch (err) {
                console.error("Failed to fetch models", err);
            }
        };
        loadInitial();
    }, []);

    useEffect(() => {
        const handleSettingsUpdated = () => setProviderSettings(loadProviderSettings());
        window.addEventListener('tcgen-provider-settings-updated', handleSettingsUpdated);
        return () => window.removeEventListener('tcgen-provider-settings-updated', handleSettingsUpdated);
    }, []);

    useEffect(() => {
        if (provider !== 'ollama') {
            setModels([]);
            setSelectedModel(AUTO_MODEL);
            return;
        }
        const baseUrl = providerSettings.ollamaBaseUrl || 'http://127.0.0.1:11434';
        fetchModels(provider, baseUrl)
            .then(data => {
                const installedModels = data.chatModels || data.models || [];
                setModels(installedModels);
                if (installedModels.length > 0) {
                    const savedModel = getSavedModel();
                    const modelValid = savedModel !== 'auto' && installedModels.includes(savedModel);
                    if (modelValid) {
                        setSelectedModel(savedModel);
                    } else {
                        // Saved model no longer installed — clean up & auto-select first available
                        const fallback = installedModels[0];
                        setSelectedModel(fallback);
                        saveModel(fallback);
                        if (savedModel && savedModel !== 'auto' && !installedModels.includes(savedModel)) {
                            console.warn(`[Ollama] Previous model "${savedModel}" not installed. Switched to "${fallback}".`);
                        }
                    }
                }
            })
            .catch(err => console.error("Failed to update models for provider", err));
    }, [provider, providerSettings.ollamaBaseUrl]);

    useEffect(() => {
        localStorage.setItem("testgen-sessions", JSON.stringify(sessions));
    }, [sessions]);

    const activeGenerationSteps = generationHasJira
        ? GENERATION_STEPS
        : GENERATION_STEPS.filter(step => !step.jiraOnly);

    useEffect(() => {
        if (!loading) { setActivityIndex(0); return; }
        const interval = window.setInterval(() => {
            setActivityIndex((v) => Math.min(v + 1, activeGenerationSteps.length - 1));
        }, 2200);
        return () => window.clearInterval(interval);
    }, [loading, activeGenerationSteps.length]);

    const activeSession = sessions.find((s) => s.id === activeId) || null;
    const activeSessionId = activeSession?.id;

    useEffect(() => {
        const baseHeader = SECTION_HEADERS[activePanel];
        if (activePanel !== "testcases") {
            setCurrentSectionHeader(baseHeader);
            return;
        }

        const storyId = activeSession?.aiOptions?.jiraStoryId || activeSession?.result?.testCases?.[0]?.linkedRequirementId || "";
        setCurrentSectionHeader({
            title: baseHeader.title,
            subtitle: storyId
                ? `Current Story: ${storyId}`
                : activeSession?.title
                    ? `Current Session: ${activeSession.title}`
                    : baseHeader.subtitle,
        });
    }, [activePanel, activeSession?.aiOptions?.jiraStoryId, activeSession?.result?.testCases, activeSession?.title]);

    useEffect(() => {
        if (!activeSessionId || restoredSessionIdRef.current === activeSessionId) return;
        restoredSessionIdRef.current = activeSessionId;

        if (activeSession?.aiOptions) {
            setSelectedModel(activeSession.aiOptions.model);
            setProvider(activeSession.aiOptions.provider || getSavedProvider());
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
            setProviderStatusInfo(prev => (
                prev.status === 'connecting'
                    ? prev
                    : { ...prev, message: prev.message || 'Checking provider...' }
            ));
            try {
                const res = await fetch('/api/health', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider, providerSettings }),
                });
                const payload = await res.json();
                const connected = Boolean(payload.connected);
                const status = payload.status === 'fallback'
                    ? 'fallback'
                    : connected
                        ? 'connected'
                        : 'error';

                if (connected || payload.status === 'fallback') {
                    providerFailureCountRef.current = 0;
                } else {
                    providerFailureCountRef.current += 1;
                }

                if (connected || payload.status === 'fallback') {
                    setProviderStatus('connected');
                } else if (providerFailureCountRef.current >= 3) {
                    setProviderStatus('error');
                }

                if (!connected && payload.status !== 'fallback' && providerFailureCountRef.current < 3) {
                    return;
                }

                setProviderStatusInfo({
                    connected,
                    status,
                    message: payload.message || (connected ? 'Online' : 'Offline'),
                    providerUsed: payload.providerUsed,
                    model: payload.model,
                });
            } catch {
                providerFailureCountRef.current += 1;
                if (providerFailureCountRef.current >= 3) {
                    setProviderStatus('error');
                    setProviderStatusInfo({
                        connected: false,
                        status: 'error',
                        message: 'Provider status unavailable',
                    });
                }
            }
        };
        loadStatus();
        const interval = window.setInterval(loadStatus, 60000);
        return () => window.clearInterval(interval);
    }, [provider, providerSettings]);

    const refreshProviderSettings = () => {
        setProviderSettings(loadProviderSettings());
    };

    const buildPromptWithAttachments = (prompt: string) => {
        if (attachedDocuments.length === 0) return prompt;
        const documentContext = attachedDocuments.map((doc) => {
            const body = doc.text?.trim()
                ? doc.text.trim().slice(0, 12000)
                : '[Document uploaded; text extraction unavailable in browser for this file type.]';
            return `Document: ${doc.name}\n${body}`;
        }).join('\n\n---\n\n');
        return `${prompt}\n\nAttached document context:\n${documentContext}`;
    };

    const handleAttachDocuments = async (files: FileList | File[]) => {
        const allowedExtensions = ['pdf', 'docx', 'txt', 'md', 'json', 'yaml', 'yml'];
        const nextDocs: AttachedDocument[] = [];
        for (const file of Array.from(files)) {
            const extension = file.name.split('.').pop()?.toLowerCase() || '';
            if (!allowedExtensions.includes(extension)) continue;
            const canReadText = ['txt', 'md', 'json', 'yaml', 'yml'].includes(extension);
            nextDocs.push({
                name: file.name,
                type: file.type || extension,
                text: canReadText ? await file.text() : undefined,
            });
        }
        if (nextDocs.length > 0) {
            setAttachedDocuments(prev => [...prev, ...nextDocs]);
        }
    };

    const handleRemoveAttachment = (name: string) => {
        setAttachedDocuments(prev => prev.filter(doc => doc.name !== name));
    };

    const handleUseMemoryAsContext = (record: MemoryVaultRecord) => {
        setAttachedMemoryContext(record);
        setActivePanel('testcases');
    };

    const handleClearMemoryContext = () => {
        setAttachedMemoryContext(null);
    };

    const saveGeneratedTestCasesToMemory = (params: {
        prompt: string;
        result: ParsedTestCaseResult;
        jiraStoryId?: string;
        sessionTitle?: string;
    }) => {
        const projectKey = projectKeyFromText(params.jiraStoryId || params.prompt);
        upsertMemoryVaultRecord({
            projectKey,
            sourceType: "generated_test_cases",
            title: params.jiraStoryId || params.sessionTitle || generateWorkspaceName(params.prompt),
            content: JSON.stringify(params.result.testCases, null, 2),
            metadata: {
                jiraStoryId: params.jiraStoryId,
                prompt: params.prompt,
                count: params.result.testCases.length,
            },
        });
    };

    const saveAttachmentsToMemory = (docs: AttachedDocument[], prompt: string) => {
        const projectKey = projectKeyFromText(prompt);
        docs.forEach(doc => {
            upsertMemoryVaultRecord({
                projectKey,
                sourceType: "document_metadata",
                title: doc.name,
                content: doc.text || `Document uploaded: ${doc.name}`,
                metadata: {
                    documentName: doc.name,
                    documentType: doc.type,
                    hasTextContent: Boolean(doc.text),
                },
            });
        });
    };

    const saveAutomationSummaryToMemory = (summary: AutomationRunResponse | AutomationExecutionSummary & { status?: string; suite?: string }, prompt?: string) => {
        if (!summary.runId) return;
        const projectKey = projectKeyFromText(prompt || summary.runId);
        upsertMemoryVaultRecord({
            id: `automation-${summary.runId}`,
            projectKey,
            sourceType: "automation_summary",
            title: `${summary.suite || "generated"} - ${summary.runId}`,
            content: [
                `Run ID: ${summary.runId}`,
                `Suite: ${summary.suite || "generated"}`,
                `Status: ${summary.status || "completed"}`,
                `Passed: ${summary.passed ?? 0}`,
                `Failed: ${summary.failed ?? 0}`,
                `Duration: ${summary.durationMs ?? 0}ms`,
                summary.playwrightReportUrl ? `Playwright Report: ${summary.playwrightReportUrl}` : "",
                summary.allureReportUrl ? `Allure Report: ${summary.allureReportUrl}` : "",
                summary.healingReportUrl ? `Healing Report: ${summary.healingReportUrl}` : "",
                summary.logUrl ? `Execution Log: ${summary.logUrl}` : "",
            ].filter(Boolean).join("\n"),
            metadata: {
                runId: summary.runId,
                suite: summary.suite || "generated",
                status: summary.status,
                playwrightReportUrl: summary.playwrightReportUrl,
                allureReportUrl: summary.allureReportUrl,
                healingReportUrl: summary.healingReportUrl,
                logUrl: summary.logUrl,
            },
        });
    };

    const handleSend = async (overridePrompt?: string, overrideOptions?: Partial<AiGenerationOptions>) => {
        if (loading) return;
        const textToSubmit = typeof overridePrompt === "string" ? overridePrompt : value;
        if (!textToSubmit.trim()) return;

        const currentPrompt = textToSubmit;
        const promptJiraStoryId = extractJiraId(currentPrompt) ?? '';
        const requestProjectKey = projectKeyFromText(currentPrompt, promptJiraStoryId);
        const memoryContext = attachedMemoryContext && normalizeProjectKey(attachedMemoryContext.projectKey) === requestProjectKey
            ? buildMemoryContextBlock(attachedMemoryContext)
            : undefined;
        setGenerationHasJira(Boolean(promptJiraStoryId || overrideOptions?.jiraStoryId));
        setGenerationFailed(false);
        setActivityIndex(0);
        const generationOptions: AiGenerationOptions = {
            model: overrideOptions?.model ?? selectedModel,
            provider: overrideOptions?.provider ?? provider,
            platformType: overrideOptions?.platformType ?? platformType,
            customPrompt: overrideOptions?.customPrompt ?? '',
            acceptanceCriteria: overrideOptions?.acceptanceCriteria ?? '',
            jiraStoryId: overrideOptions?.jiraStoryId ?? promptJiraStoryId,
        };

        saveModel(generationOptions.model);
        saveProvider(generationOptions.provider);
        setGeneratingPrompt(currentPrompt);
        setGenerationModelStatus(
            generationOptions.provider === 'auto'
                ? "Auto fallback enabled"
                : `Using: ${generationOptions.provider}`
        );
        setLoading(true);
        setValue("");
        if (textareaRef.current) textareaRef.current.style.height = "52px";

        const targetId = activeId ?? Date.now().toString();
        const now = new Date().toISOString();
        const smartName = generateWorkspaceName(currentPrompt);
        const initialTargetUrl = extractTargetUrl(currentPrompt);

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
                    provider: generationOptions.provider,
                    message: generationOptions.provider === 'auto' ? "Auto fallback enabled" : `Using: ${generationOptions.provider}`,
                },
                generatedScript: undefined,
                scriptFileName: undefined,
                automationTarget: {
                    sessionId: targetId,
                    jiraStoryId: generationOptions.jiraStoryId,
                    sessionTitle: smartName,
                    targetUrl: initialTargetUrl,
                    targetUrlSource: initialTargetUrl ? 'jira_story' : undefined,
                    generatedTestCaseIds: [],
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
                        generatedScript: undefined,
                        scriptFileName: undefined,
                        automationTarget: {
                            ...(s.automationTarget || { sessionId: targetId }),
                            sessionId: targetId,
                            jiraStoryId: generationOptions.jiraStoryId,
                            sessionTitle: s.title,
                            targetUrl: initialTargetUrl || s.automationTarget?.targetUrl,
                            targetUrlSource: initialTargetUrl ? 'jira_story' : s.automationTarget?.targetUrlSource,
                            generatedTestCaseIds: [],
                            generatedScriptPath: undefined,
                        },
                        aiOptions: generationOptions,
                        aiMeta: {
                            requestedModel: generationOptions.model,
                            provider: generationOptions.provider,
                            message: generationOptions.provider === 'auto' ? "Auto fallback enabled" : `Using: ${generationOptions.provider}`,
                        },
                        updatedAt: now
                    }
                    : s
            ));
        }

        try {
            const data = await generateTestCases(
                buildPromptWithAttachments(currentPrompt),
                generationOptions.model,
                "functional",
                generationOptions.platformType,
                generationOptions.customPrompt,
                generationOptions.acceptanceCriteria,
                generationOptions.provider,
                generationOptions.jiraStoryId,
                providerSettings,
                memoryContext
            ) as GenerateApiResponse;

            if (data.meta?.message) {
                setGenerationModelStatus(data.meta.message);
                setProviderStatusInfo(prev => ({
                    ...prev,
                    status: data.meta?.fallbackUsed ? 'fallback' : 'connected',
                    connected: true,
                    message: data.meta?.message || prev.message,
                    providerUsed: data.meta?.providerUsed,
                    model: data.meta?.activeModel || data.meta?.model,
                }));
            }

            if (data.error && data.meta?.message === 'All Providers Failed') {
                setProviderStatus('error');
                setProviderStatusInfo({
                    connected: false,
                    status: 'error',
                    message: 'All Providers Failed',
                    providerUsed: data.meta.providerUsed,
                    model: data.meta.activeModel || data.meta.model,
                });
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
                        automationTarget: buildAutomationTarget({
                            ...s,
                            prompt: currentPrompt,
                            aiOptions: generationOptions,
                            result: parsedResult,
                        }),
                        updatedAt: new Date().toISOString()
                    }
                    : s
            ));
            if (parsedResult?.testCases?.length) {
                saveGeneratedTestCasesToMemory({
                    prompt: currentPrompt,
                    result: parsedResult,
                    jiraStoryId: generationOptions.jiraStoryId,
                    sessionTitle: smartName,
                });
            }
            if (attachedDocuments.length > 0) saveAttachmentsToMemory(attachedDocuments, currentPrompt);
        } catch (error) {
            const generationError = error as GenerationError;
            const payload = generationError.payload;
            const msg = String(payload?.error || payload?.message || payload?.result || generationError.message || 'Generation failed');
            setGenerationFailed(true);
            setGenerationModelStatus(msg);
            setProviderStatusInfo(prev => ({
                ...prev,
                status: payload?.meta?.fallbackUsed ? 'fallback' : 'error',
                connected: false,
                message: msg,
                providerUsed: payload?.meta?.providerUsed,
                model: payload?.meta?.activeModel || payload?.meta?.model,
            }));
            setSessions(prev => prev.map(s =>
                s.id === targetId
                    ? {
                        ...s,
                        result: null,
                        error: msg,
                        aiOptions: generationOptions,
                        aiMeta: payload?.meta || { requestedModel: generationOptions.model, provider: generationOptions.provider, message: msg },
                        updatedAt: new Date().toISOString()
                    }
                    : s
            ));
        } finally {
            if (memoryContext) setAttachedMemoryContext(null);
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
            automationTarget: {
                sessionId: id,
                sessionTitle: 'New Workspace',
                generatedTestCaseIds: [],
            },
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
        setAttachedDocuments([]);
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
                    provider: currentThread?.aiOptions?.provider || provider,
                    providerSettings,
                    model: currentThread?.aiOptions?.model || selectedModel,
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
            setSessions(prev => prev.map(s =>
                s.id === activeId
                    ? {
                        ...s,
                        generatedScript: generatedCode,
                        scriptFileName: generatedFileName,
                        automationTarget: {
                            ...buildAutomationTarget({ ...s, scriptFileName: generatedFileName }),
                            targetUrlSource: s.automationTarget?.targetUrlSource || (s.automationTarget?.targetUrl ? 'generated_script' : undefined),
                        },
                        updatedAt: new Date().toISOString()
                    }
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
        focusAutomationLogs();
        const storyId = currentThread?.aiOptions?.jiraStoryId || '';
        const targetUrl = currentThread?.automationTarget?.targetUrl;
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
                    targetUrl,
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
                                    saveAutomationSummaryToMemory(data, currentThread?.prompt);
                                    if (data.playwrightReportUrl || data.reportUrl) setReportUrl(data.playwrightReportUrl || data.reportUrl);
                                    showAutomationToast({
                                        type: data.status === 'partial_success' ? 'partial_success' : data.failed > 0 ? 'failed' : 'success',
                                        message: data.failed > 0
                                            ? `Generated script failed. ${data.passed} passed, ${data.failed} failed.`
                                            : data.status === 'partial_success'
                                                ? `Generated script completed with report warnings. ${data.passed} passed, ${data.failed} failed.`
                                                : `Generated script completed. ${data.passed} passed, ${data.failed} failed.`,
                                        reportUrl: data.playwrightReportUrl || data.reportUrl,
                                        persistent: data.failed > 0 || data.status === 'partial_success' || Boolean(data.playwrightReportUrl || data.reportUrl),
                                    });
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
            showAutomationToast({ type: 'error', message: `Generated script error: ${message}`, persistent: true });
        } finally {
            setIsRunningAutomation(false);
        }
    };

    const handleExecuteSuite = async (suite: SuiteKey, headed: boolean = false) => {
        const targetId = activeId;
        const currentThread = sessions.find(s => s.id === targetId);
        focusAutomationLogs();
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
                status: response.ok && !payload.error && payload.status !== 'failed' && payload.status !== 'error' ? 'completed' : 'failed',
                lastRunAt: finishedAt,
                reportUrl: payload.reportUrl || undefined,
                playwrightReportUrl: payload.playwrightReportUrl || payload.reportUrl || undefined,
                allureReportUrl: payload.allureReportUrl || undefined,
                healingReportUrl: payload.healingReportUrl || undefined,
                logUrl: payload.logUrl || undefined,
                runId: payload.runId,
                message: payload.message,
                durationMs: payload.durationMs,
                output: payload.output,
                stderr: payload.stderr,
                failedTests: payload.failedTests,
                targetUrl: payload.targetUrl,
                browser: payload.browser,
            };
            setExecutionSummary({
                total: payload.total ?? 0,
                passed: payload.passed ?? 0,
                failed: payload.failed ?? (suiteState.status === 'failed' ? 1 : 0),
                durationMs: payload.durationMs,
                reportUrl: payload.reportUrl || undefined,
                playwrightReportUrl: payload.playwrightReportUrl || payload.reportUrl || undefined,
                allureReportUrl: payload.allureReportUrl || undefined,
                healingReportUrl: payload.healingReportUrl || undefined,
                logUrl: payload.logUrl || undefined,
                runId: payload.runId || undefined,
            });
            setReportUrl(payload.playwrightReportUrl || payload.reportUrl || null);
            setPassedTests([]);
            setFailedTests(payload.failedTests || []);
            setExecutionLogs(payload.logs?.map(line => `[${new Date().toLocaleTimeString()}] ${line}`) || []);
            showAutomationToast({
                type: payload.status === 'partial_success' ? 'partial_success' : suiteState.status === 'failed' ? 'failed' : 'success',
                message: suiteState.status === 'failed'
                    ? `${suite} suite failed. ${payload.passed ?? 0} passed, ${payload.failed ?? 0} failed.`
                    : payload.status === 'partial_success'
                        ? `${suite} suite completed with report warnings. ${payload.passed ?? 0} passed, ${payload.failed ?? 0} failed.`
                        : `${suite} suite completed. ${payload.passed ?? 0} passed, ${payload.failed ?? 0} failed.`,
                reportUrl: payload.playwrightReportUrl || payload.reportUrl,
                persistent: suiteState.status === 'failed' || payload.status === 'partial_success' || Boolean(payload.playwrightReportUrl || payload.reportUrl),
            });
            saveAutomationSummaryToMemory({ ...payload, suite }, currentThread?.prompt);

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
                            automationRuns: payload.runId
                                ? [
                                    {
                                        runId: payload.runId,
                                        suite,
                                        targetUrl: payload.targetUrl,
                                        browser: payload.browser,
                                        mode: payload.mode,
                                        status: payload.status === 'completed' ? 'passed' : payload.status,
                                        startedAt: payload.startedAt,
                                        finishedAt: payload.finishedAt,
                                        durationMs: payload.durationMs,
                                        passed: payload.passed,
                                        failed: payload.failed,
                                        logs: payload.logs,
                                        playwrightReportUrl: payload.playwrightReportUrl || payload.reportUrl || null,
                                        allureReportUrl: payload.allureReportUrl || null,
                                        healingReportUrl: payload.healingReportUrl || null,
                                        logUrl: payload.logUrl || null,
                                        errors: payload.errors,
                                    },
                                    ...(s.automationRuns || []),
                                ].slice(0, 20)
                                : s.automationRuns,
                            automationTarget: s.automationTarget ? { ...s.automationTarget, latestRunId: payload.runId } : s.automationTarget,
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
            showAutomationToast({ type: 'error', message: `${suite} suite error: ${failedState.message}`, persistent: true });

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
        currentSectionHeader,
        generatingPrompt, setGeneratingPrompt,
        generationModelStatus, setGenerationModelStatus,
        activityIndex,
        generationFailed,
        progressLabel: activeGenerationSteps[Math.min(activityIndex, activeGenerationSteps.length - 1)]?.label || 'Generating test cases...',
        generationProgress: activeGenerationSteps[Math.min(activityIndex, activeGenerationSteps.length - 1)]?.percent || 0,
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
        automationToast, setAutomationToast,
        dashboardAutomation, setDashboardAutomation,
        jiraModalOpen, setJiraModalOpen,
        jiraTargetCase, setJiraTargetCase,
        textareaRef,
        messagesEndRef,
        activeSession,
        currentThread: sessions.find(s => s.id === activeId),
        automationState: (sessions.find(s => s.id === activeId))?.automation ?? dashboardAutomation,
        automationTarget: sessions.find(s => s.id === activeId)?.automationTarget,
        automationRuns: sessions.find(s => s.id === activeId)?.automationRuns || [],
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
        saveModel,
        providerSettings,
        setProviderSettings,
        refreshProviderSettings,
        providerStatusInfo,
        attachedDocuments,
        handleAttachDocuments,
        handleRemoveAttachment,
        attachedMemoryContext,
        handleUseMemoryAsContext,
        handleClearMemoryContext
    };
}
