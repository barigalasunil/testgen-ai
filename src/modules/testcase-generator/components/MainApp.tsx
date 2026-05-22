"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Bot, Settings } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ChatMessage } from "./ChatMessage";
import { InputBox } from "./InputBox";
import { generateTestCases, fetchModels } from "../services";
import { HistoryItem } from "../types";

export function MainApp() {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [generatingPrompt, setGeneratingPrompt] = useState("");
    
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

    // Initial Fetch (History & Models)
    useEffect(() => {
        const saved = localStorage.getItem("testgen-history");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setHistory(parsed);
                if (parsed.length > 0 && window.innerWidth >= 768) {
                    setIsSidebarOpen(true);
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [activeId, loading]);

    const handleSend = async (overridePrompt?: string, isRegenerate = false) => {
        if (loading) return;
        const textToSubmit = typeof overridePrompt === "string" ? overridePrompt : value;
        if (!textToSubmit.trim()) return;

        const currentPrompt = textToSubmit;
        setGeneratingPrompt(currentPrompt);
        setLoading(true);
        setValue("");
        if (textareaRef.current) textareaRef.current.style.height = "52px";

        let targetId = Date.now().toString();

        if (isRegenerate && activeId) {
            targetId = activeId;
            setHistory(prev => prev.map(h => h.id === targetId ? { ...h, result: null, error: null } : h));
        } else {
            setActiveId(targetId);
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

            setHistory(prev => {
                let newHistory;
                if (isRegenerate && activeId) {
                    newHistory = prev.map(h => h.id === targetId ? { ...h, result: data.error ? null : data.result, error: data.error ? data.result : null } : h);
                } else {
                    newHistory = [{ id: targetId, prompt: currentPrompt, result: data.error ? null : data.result, error: data.error ? data.result : null, timestamp: Date.now() }, ...prev];
                }
                localStorage.setItem("testgen-history", JSON.stringify(newHistory));
                return newHistory;
            });
        } catch (error) {
            const msg = "Network Error: " + (error as Error).message;
            setHistory(prev => {
                let newHistory;
                if (isRegenerate && activeId) {
                    newHistory = prev.map(h => h.id === targetId ? { ...h, result: null, error: msg } : h);
                } else {
                    newHistory = [{ id: targetId, prompt: currentPrompt, result: null, error: msg, timestamp: Date.now() }, ...prev];
                }
                localStorage.setItem("testgen-history", JSON.stringify(newHistory));
                return newHistory;
            });
        } finally {
            setLoading(false);
        }
    };

    const handleNewChat = () => {
        setActiveId(null);
        setValue("");
        if(window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleSelectChat = (id: string) => {
        setActiveId(id);
        if(window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleRename = (id: string, newTitle: string) => {
        setHistory(prev => {
            const updated = prev.map(h => h.id === id ? { ...h, title: newTitle } : h);
            localStorage.setItem("testgen-history", JSON.stringify(updated));
            return updated;
        });
    };

    const handleDelete = (id: string) => {
        setHistory(prev => {
            const updated = prev.filter(h => h.id !== id);
            localStorage.setItem("testgen-history", JSON.stringify(updated));
            return updated;
        });
        if (activeId === id) {
            setActiveId(null);
            if(window.innerWidth < 768) setIsSidebarOpen(false);
        }
    };

    const currentThread = history.find(h => h.id === activeId);

    const copyTableData = () => {
        if (!currentThread?.result) return;
        const text = currentThread.result.testCases.map(tc => 
            `ID: ${tc.testCaseId}\nTitle: ${tc.title}\nType: ${tc.testType}\nPriority: ${tc.priority}\nPreconditions: ${tc.preconditions}\nTest Data: ${tc.testData}\nSteps: ${tc.steps}\nExpected: ${tc.expectedResult}`
        ).join("\n\n---\n\n");
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="flex h-screen bg-white text-gray-800 overflow-hidden font-sans w-full">
            
            <Sidebar 
                history={history} 
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Jira URL</label>
                                    <input type="text" placeholder="https://yourdomain.atlassian.net" className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10A37F]/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username / Email</label>
                                    <input type="text" placeholder="name@company.com" className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10A37F]/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                                    <input type="password" placeholder="••••••••••••••••" className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10A37F]/50" />
                                </div>
                            </div>
                            <div className="p-4 border-t border-gray-200 flex justify-end">
                                <button onClick={() => setIsSettingsOpen(false)} className="bg-[#10A37F] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-600 transition-colors">Save Credentials</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
                
                <header className="h-14 border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 bg-white z-10 shrink-0 shadow-sm w-full">
                    <div className="flex items-center">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 mr-2 hover:bg-gray-100 rounded-md text-gray-500 md:hidden">
                            <Menu className="w-5 h-5" />
                        </button>
                        <h1 className="font-semibold text-[15px] sm:text-base text-gray-800">TCGen-Buddy</h1>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto w-full scroll-smooth flex flex-col pb-40 text-sm md:text-base">
                    
                    {!currentThread && !loading ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center px-4 w-full h-full">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                                <Bot className="w-8 h-8 text-gray-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">TCGen-Buddy</h2>
                            <p className="text-gray-500">Generate platform-aware UAT test cases for Web, Mobile, or API.</p>
                        </motion.div>
                    ) : (
                        <div className="w-full flex flex-col">
                            {currentThread && (
                                <>
                                    <ChatMessage role="user" content={currentThread.prompt} />
                                    {currentThread.error ? (
                                        <ChatMessage role="assistant" content={currentThread.error} />
                                    ) : currentThread.result ? (
                                        <ChatMessage 
                                            role="assistant" 
                                            isTable 
                                            tableData={currentThread.result} 
                                            jiraStoryId={jiraStoryId}
                                            onCopy={copyTableData} 
                                            onRegenerate={() => handleSend(currentThread.prompt, true)}
                                        />
                                    ) : null}
                                </>
                            )}

                            {loading && activeId && !currentThread && (
                                <>
                                    <ChatMessage role="user" content={generatingPrompt} />
                                    <ChatMessage role="assistant" isLoading />
                                </>
                            )}
                            
                            <div ref={messagesEndRef} className="h-4" />
                        </div>
                    )}
                </div>

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
    );
}
