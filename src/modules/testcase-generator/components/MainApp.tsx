"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Bot, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { ChatMessage } from "./ChatMessage";
import { InputBox } from "./InputBox";
import { AutomationDashboard } from "./AutomationDashboard";
import { generateTestCases, fetchModels } from "../services";
import { HistoryItem } from "../types";

export function MainApp() {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<HistoryItem[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [generatingPrompt, setGeneratingPrompt] = useState("");
    const [resultTab, setResultTab] = useState<'testCases' | 'scripts' | 'logs'>('testCases');
    const [ollamaStatus, setOllamaStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
    const [activityIndex, setActivityIndex] = useState(0);
    
    const activityMessages = [
        'Generating functional scenarios...',
        'Generating negative validations...',
        'Generating boundary checks...',
        'Formatting output...',
    ];
    
    // Feature States
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState("phi3:mini");
    const [isJiraMode, setIsJiraMode] = useState(false);
    const [platformType, setPlatformType] = useState<"web" | "mobile" | "api">("web");
    const [customPrompt, setCustomPrompt] = useState("");
    const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
    const [jiraStoryId, setJiraStoryId] = useState("");

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial Fetch (Sessions & Models)
    useEffect(() => {
        const saved = localStorage.getItem("testgen-sessions");
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as HistoryItem[];
                setSessions(parsed);
                if (parsed.length > 0) {
                    setActiveId(parsed[0].id);
                    if (window.innerWidth >= 768) {
                        setIsSidebarOpen(true);
                    }
                }
            } catch (e) { }
        }

        fetchModels()
            .then(data => {
                if (data.models && data.models.length > 0) {
                    setModels(data.models);
                    if (!data.models.includes(selectedModel)) setSelectedModel(data.models[0]);
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

    useEffect(() => {
        scrollToBottom();
    }, [activeId, loading]);

    useEffect(() => {
        setResultTab('testCases');
    }, [activeId]);

    const activeSession = sessions.find((session) => session.id === activeId) || null;

    useEffect(() => {
        if (activeSession) {
            setPlatformType(activeSession.platform);
            setValue('');
        }
    }, [activeSession?.id]);

    useEffect(() => {
        const loadStatus = async () => {
            try {
                const health = await fetch('/api/health');
                const payload = await health.json();
                if (health.ok && payload.connected) {
                    setOllamaStatus('connected');
                } else {
                    setOllamaStatus('offline');
                }
            } catch {
                setOllamaStatus('offline');
            }
        };

        loadStatus();
        const interval = window.setInterval(loadStatus, 15000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!loading) {
            setActivityIndex(0);
            return;
        }

        const interval = window.setInterval(() => {
            setActivityIndex((value) => (value + 1) % activityMessages.length);
        }, 2200);

        return () => window.clearInterval(interval);
    }, [loading]);

    const progressLabel = loading ? activityMessages[activityIndex] : 'AI is ready for new prompts.';

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

    const currentThread = sessions.find(session => session.id === activeId);
    const hasGeneratedResults = Boolean(currentThread?.result?.testCases?.length || currentThread?.error);

    const handleSend = async (overridePrompt?: string, isRegenerate = false) => {
        if (loading) return;
        const textToSubmit = typeof overridePrompt === "string" ? overridePrompt : value;
        if (!textToSubmit.trim()) return;

        const currentPrompt = textToSubmit;
        setGeneratingPrompt(currentPrompt);
        setLoading(true);
        setValue("");
        if (textareaRef.current) textareaRef.current.style.height = "52px";

        let targetId = activeId ?? Date.now().toString();
        if (isRegenerate && activeId) {
            setSessions(prev => prev.map(session =>
                session.id === activeId
                    ? { ...session, result: null, error: null, updatedAt: new Date().toISOString() }
                    : session
            ));
        }

        if (!isRegenerate && !activeId) {
            setActiveId(targetId);
            setSessions(prev => [
                {
                    id: targetId,
                    title: `Workspace ${prev.length + 1}`,
                    prompt: currentPrompt,
                    platform: platformType,
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
                },
                ...prev,
            ]);
        }

        try {
            const data = await generateTestCases(
                currentPrompt,
                selectedModel,
                "functional",
                platformType,
                customPrompt,
                acceptanceCriteria
            );

            const parsedResult =
                data &&
                !data.error &&
                data.result &&
                typeof data.result === 'object' &&
                Array.isArray((data.result as any).testCases)
                    ? data.result
                    : null;
            let parsedError: string | null = null;
            if (data && data.error) {
                parsedError = String(data.result || data.error);
            } else if (data && !data.error && data.result && typeof data.result === 'object' && typeof (data.result as any).raw === 'string') {
                parsedError = String((data.result as any).raw);
            }

            setSessions(prev => prev.map(session =>
                session.id === targetId
                    ? {
                        ...session,
                        prompt: currentPrompt,
                        platform: platformType,
                        result: parsedResult,
                        error: parsedError,
                        updatedAt: new Date().toISOString(),
                    }
                    : session
            ));
        } catch (error) {
            const msg = "Network Error: " + (error as Error).message;
            setSessions(prev => prev.map(session =>
                session.id === targetId
                    ? { ...session, result: null, error: msg, updatedAt: new Date().toISOString() }
                    : session
            ));
        } finally {
            setLoading(false);
        }
    };

    const handleNewChat = () => {
        const id = Date.now().toString();
        const newSession: HistoryItem = {
            id,
            title: `Workspace ${sessions.length + 1}`,
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
        };
        setSessions(prev => [newSession, ...prev]);
        setActiveId(id);
        setValue("");
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleSelectChat = (id: string) => {
        setActiveId(id);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleRename = (id: string, newTitle: string) => {
        setSessions(prev => {
            const updated = prev.map(session => session.id === id ? { ...session, title: newTitle, updatedAt: new Date().toISOString() } : session);
            return updated;
        });
    };

    const handleDelete = (id: string) => {
        setSessions(prev => {
            const updated = prev.filter(session => session.id !== id);
            if (activeId === id) {
                setActiveId(updated[0]?.id ?? null);
            }
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

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 shadow-sm z-10">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">AI QA Copilot</p>
                        <h1 className="text-lg font-semibold text-slate-900">TCGen-Buddy Workspace</h1>
                        <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">Generate test cases, export artifacts, and run automation suites.</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-sm">
                        <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium", statusColor)}>
                            <span className={cn("h-2.5 w-2.5 rounded-full", ollamaStatus === 'connected' ? 'bg-emerald-500' : ollamaStatus === 'offline' ? 'bg-red-500' : 'bg-amber-500')} />
                            {statusLabel}
                        </span>
                    </div>
                </div>

                <div className="flex flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <section className="h-full overflow-y-auto px-4 py-5 lg:px-6">
                        <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-6">
                            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="max-w-2xl">
                                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400 font-semibold">AI Generation</p>
                                        <h2 className="text-xl font-semibold text-slate-900">Create test cases with AI</h2>
                                        <p className="mt-2 text-sm text-slate-500">Describe your scenario, choose a platform, and generate quality test cases instantly.</p>
                                    </div>
                                    <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600 border border-slate-200">
                                        <div className="font-semibold text-slate-900">{progressLabel}</div>
                                        {loading && <div className="mt-1 text-xs text-slate-500">{generatingPrompt || 'AI is analyzing your request.'}</div>}
                                    </div>
                                </div>
                            </div>

                            {!hasGeneratedResults && !loading ? (
                                <div className="rounded-[32px] border border-slate-200 bg-white p-10 shadow-sm">
                                    <div className="text-center mx-auto max-w-2xl">
                                        <p className="text-sm uppercase tracking-[0.24em] text-slate-400 font-semibold">Ready to generate</p>
                                        <h2 className="mt-4 text-3xl font-semibold text-slate-900">AI-generated test cases will appear here.</h2>
                                        <p className="mt-3 text-sm text-slate-500">Start with a feature idea and let TCGen-Buddy produce structured QA scenarios for your team.</p>

                                        <div className="mt-8 grid gap-3 sm:grid-cols-2 text-left text-sm text-slate-600">
                                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                                <p className="font-semibold text-slate-900">Functional testing</p>
                                                <p className="mt-1 text-slate-500">Build coverage for core application flows.</p>
                                            </div>
                                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                                <p className="font-semibold text-slate-900">Negative scenarios</p>
                                                <p className="mt-1 text-slate-500">Capture invalid inputs and edge conditions.</p>
                                            </div>
                                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                                <p className="font-semibold text-slate-900">Boundary validations</p>
                                                <p className="mt-1 text-slate-500">Focus on limit cases and unexpected behavior.</p>
                                            </div>
                                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                                <p className="font-semibold text-slate-900">API workflows</p>
                                                <p className="mt-1 text-slate-500">Generate test cases for backend endpoints.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold text-slate-900">Generated Results</h2>
                                            <p className="mt-1 text-sm text-slate-500">Review the latest AI output, export data, or inspect logs.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {['testCases', 'scripts', 'logs'].map((tab) => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setResultTab(tab as 'testCases' | 'scripts' | 'logs')}
                                                    className={cn(
                                                        'rounded-full px-4 py-2 text-sm font-semibold transition',
                                                        resultTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    )}
                                                >
                                                    {tab === 'testCases' ? 'Test Cases' : tab === 'scripts' ? 'Generated Scripts' : 'Execution Logs'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-6 min-h-[360px]">
                                        {loading ? (
                                            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                                                <div className="text-lg font-semibold text-slate-800">AI is generating your suite...</div>
                                                <p className="mt-3 text-sm">This usually takes a few seconds. Your results will appear here once ready.</p>
                                            </div>
                                        ) : currentThread ? (
                                            <div>
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                                                    <div>
                                                        <p className="text-sm text-slate-500">Latest prompt</p>
                                                        <p className="mt-1 text-sm text-slate-700">{currentThread.prompt}</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                                        <span className="rounded-full bg-slate-100 px-3 py-1">Platform: {platformType}</span>
                                                        {currentThread.error ? <span className="rounded-full bg-red-100 text-red-700 px-3 py-1">Error detected</span> : <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1">Results ready</span>}
                                                    </div>
                                                </div>

                                                {resultTab === 'testCases' && currentThread.result && (
                                                    <ChatMessage 
                                                        role="assistant" 
                                                        isTable 
                                                        tableData={currentThread.result} 
                                                        jiraStoryId={jiraStoryId}
                                                        platformType={platformType}
                                                        onCopy={copyTableData} 
                                                        onRegenerate={() => handleSend(currentThread.prompt, true)}
                                                    />
                                                )}

                                                {resultTab === 'scripts' && (
                                                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                                                        <h3 className="text-base font-semibold text-slate-900 mb-3">Generated Scripts</h3>
                                                        <p className="mb-4">Create a Playwright script after your test cases are generated. Use the "Generate Script" action available in the result table.</p>
                                                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                                                            <p className="text-sm text-slate-500">Script preview will appear here once generated.</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {resultTab === 'logs' && (
                                                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                                                        <h3 className="text-base font-semibold text-slate-900 mb-3">Execution Logs</h3>
                                                        {currentThread.error ? (
                                                            <pre className="whitespace-pre-wrap break-words rounded-2xl bg-white p-4 text-xs text-slate-700 border border-slate-200">{currentThread.error}</pre>
                                                        ) : (
                                                            <p className="text-sm text-slate-500">No errors were captured. If a suite fails, logs and details will appear here.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                                                <div className="text-lg font-semibold text-slate-800">No results available yet</div>
                                                <p className="mt-3 text-sm">Send a prompt and the AI output will be shown here with tabs for Test Cases, Scripts, and Logs.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                            </section>
                        </div>

                        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-slate-50/95 backdrop-blur-sm px-4 py-4 shadow-inner">
                            <InputBox 
                                value={value} 
                                onChange={setValue} 
                                onSend={handleSend} 
                                disabled={loading} 
                                inputRef={textareaRef} 
                                models={models}
                                selectedModel={selectedModel}
                                setSelectedModel={setSelectedModel}
                                isJiraMode={isJiraMode}
                                setIsJiraMode={setIsJiraMode}
                                platformType={platformType}
                                setPlatformType={setPlatformType}
                                customPrompt={customPrompt}
                                setCustomPrompt={setCustomPrompt}
                                acceptanceCriteria={acceptanceCriteria}
                                setAcceptanceCriteria={setAcceptanceCriteria}
                                jiraStoryId={jiraStoryId}
                                setJiraStoryId={setJiraStoryId}
                            />
                        </div>
                    </div>

                    <aside className="hidden xl:flex w-[340px] sticky top-0 h-screen flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 pb-6">
                        <AutomationDashboard compact />
                    </aside>
                </div>
            </main>

            <AnimatePresence>
                {isSettingsOpen && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Settings className="w-4 h-4"/> Jira Integration Settings</h2>
                                <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-gray-900"><X className="w-4 h-4"/></button>
                            </div>
                            <div className="p-5 flex flex-col gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Jira Base URL</label>
                                    <input type="text" placeholder="https://yourdomain.atlassian.net" className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10A37F]/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input type="text" placeholder="name@company.com" className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10A37F]/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                                    <input type="password" placeholder="••••••••••••••••" className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10A37F]/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Key</label>
                                    <input type="text" placeholder="PROJ" className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10A37F]/50" />
                                </div>
                            </div>
                            <div className="p-4 border-t border-gray-200 flex justify-end">
                                <button onClick={() => setIsSettingsOpen(false)} className="bg-[#10A37F] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-600 transition-colors">Save Credentials</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
