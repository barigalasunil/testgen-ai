"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Menu, X, Plus, Bot, Download, Copy, User, Settings, ChevronDown, Link as LinkIcon, RefreshCw, ThumbsUp, MoreHorizontal, Pencil, Trash } from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

// --- Types ---
type TestCase = {
    id: string;
    title: string;
    description?: string;
    steps: string;
    expectedResult: string;
    priority?: string;
};

type HistoryItem = {
    id: string;
    prompt: string;
    result: { testCases: TestCase[] } | null;
    error: string | null;
    timestamp: number;
};

// --- Reusable Components ---

function Sidebar({ history, activeId, onSelect, onNewChat, isOpen, toggleSidebar, onOpenSettings, loading, onRename, onDelete }: any) {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const handleSaveTitle = (id: string) => {
        if(editValue.trim()){
            onRename(id, editValue);
        }
        setEditingId(null);
    };

    return (
        <div className={cn(
            "fixed md:static inset-y-0 left-0 z-40 bg-[#f9f9f9] border-r border-gray-200 w-[260px] flex flex-col transition-transform duration-300 ease-in-out shrink-0",
            isOpen ? "translate-x-0" : "-translate-x-full hidden md:flex md:translate-x-0"
        )}>
            <div className="p-2 flex gap-2 h-14 items-center mt-1">
                <button 
                    onClick={loading ? undefined : onNewChat}
                    disabled={loading}
                    className={cn("flex-1 flex items-center gap-3 rounded-md p-3 text-sm font-medium shadow-sm transition-colors h-11", loading ? "bg-gray-100 text-gray-400 border border-gray-100 cursor-not-allowed" : "bg-white border border-gray-200 text-gray-800 hover:bg-gray-50")}
                >
                    <Plus className={cn("w-4 h-4", loading ? "text-gray-400" : "text-gray-500")} /> New Chat
                </button>
                <button onClick={toggleSidebar} className="md:hidden border border-gray-200 bg-white rounded-md p-3 text-gray-600 h-11 flex items-center justify-center shadow-sm">
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto mt-2 px-2 custom-scrollbar">
                <div className="text-xs font-semibold text-gray-400 mb-3 px-2 py-2">Today</div>
                {history.length === 0 && <div className="text-gray-400 text-sm px-2">No history yet.</div>}
                {history.map((item: any) => (
                    <div key={item.id} className={cn("relative flex items-center group w-full rounded-md transition-colors mb-1", activeId === item.id ? "bg-gray-200" : "hover:bg-gray-100")}>
                        {editingId === item.id ? (
                            <input 
                                autoFocus
                                value={editValue} 
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleSaveTitle(item.id)}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveTitle(item.id)}
                                className="flex-1 min-w-0 bg-white py-2 pl-3 pr-2 text-sm text-gray-900 border-2 border-[#10A37F] rounded-md outline-none mx-1 my-1 shadow-sm"
                            />
                        ) : (
                            <>
                                <button onClick={() => onSelect(item.id)} className="flex-1 flex items-center gap-3 p-3 text-sm text-gray-800 font-medium text-left truncate overflow-hidden">
                                    <Bot className="w-4 h-4 shrink-0 text-gray-500" />
                                    <span className="truncate">{item.title || item.prompt}</span>
                                </button>
                                <div className="relative pr-2 shrink-0">
                                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }} className={cn("p-1.5 rounded-md text-gray-400 hover:text-gray-800 transition-opacity", activeId === item.id || openMenuId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                    {openMenuId === item.id && (
                                        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                                            <button onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditValue(item.title || item.prompt); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                <Pencil className="w-3.5 h-3.5" /> Rename
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                                <Trash className="w-3.5 h-3.5" /> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="p-2 border-t border-gray-200">
                <button onClick={onOpenSettings} className="w-full flex items-center gap-3 rounded-md p-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors font-medium">
                    <Settings className="w-4 h-4 text-gray-500" /> Settings
                </button>
            </div>
        </div>
    );
}

function TestCaseTable({ data, onCopy, onDownload, onRegenerate }: any) {
    const [liked, setLiked] = useState(false);

    if (!data || !data.testCases || data.testCases.length === 0) {
        return <div className="text-gray-500">No test cases returned or invalid JSON format from model.</div>;
    }

    return (
        <div className="w-full mt-2">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <button onClick={onCopy} className="flex items-center gap-2 text-xs bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors text-gray-700 shadow-sm">
                    <Copy className="w-3.5 h-3.5" /> Copy Data
                </button>
                <button onClick={onDownload} className="flex items-center gap-2 text-xs bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors text-gray-700 shadow-sm">
                    <Download className="w-3.5 h-3.5" /> Download Excel
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button title="Reload Result" onClick={onRegenerate} className="flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 w-8 h-8 rounded-md transition-colors text-gray-700 shadow-sm">
                    <RefreshCw className="w-4 h-4" />
                </button>
                <button title="RAG Helpful" onClick={() => setLiked(!liked)} className={cn("flex items-center justify-center border border-gray-200 w-8 h-8 rounded-md transition-colors shadow-sm", liked ? "bg-green-100 text-green-700 border-green-200" : "bg-white hover:bg-gray-50 text-gray-700")}>
                    <ThumbsUp className={cn("w-4 h-4", liked ? "fill-green-600" : "")} />
                </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="w-full text-left text-sm text-gray-800">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="p-3 border-b border-gray-200 font-semibold">ID</th>
                            <th className="p-3 border-b border-gray-200 font-semibold">Title</th>
                            <th className="p-3 border-b border-gray-200 font-semibold min-w-[200px]">Steps</th>
                            <th className="p-3 border-b border-gray-200 font-semibold min-w-[200px]">Expected Result</th>
                            <th className="p-3 border-b border-gray-200 font-semibold">Priority</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {data.testCases.map((tc: any, i: number) => (
                            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors align-top">
                                <td className="p-3 whitespace-nowrap text-gray-500">{tc.id}</td>
                                <td className="p-3 font-semibold text-gray-800">{tc.title}</td>
                                <td className="p-3 whitespace-pre-wrap leading-relaxed text-gray-700">{tc.steps}</td>
                                <td className="p-3 whitespace-pre-wrap leading-relaxed text-gray-700">{tc.expectedResult}</td>
                                <td className="p-3 text-gray-500">{tc.priority || "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ChatMessage({ role, content, isTable, tableData, onCopy, onDownload, onRegenerate, isLoading }: any) {
    const isAssistant = role === "assistant";
    return (
        <div className={cn("w-full py-6 text-gray-800 border-b border-gray-100", isAssistant ? "bg-[#f7f7f8]" : "bg-white")}>
            <div className="max-w-4xl mx-auto flex gap-4 px-4 md:px-6">
                <div className="shrink-0 mt-1">
                    {isAssistant ? (
                        <div className="w-[30px] h-[30px] rounded-sm bg-[#10A37F] flex items-center justify-center shadow-sm">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                    ) : (
                        <div className="w-[30px] h-[30px] rounded-sm bg-blue-600 flex items-center justify-center shadow-sm">
                            <User className="w-5 h-5 text-white" />
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-hidden min-w-0 flex flex-col justify-start min-h-[30px]">
                    {isLoading ? (
                        <div className="flex items-center gap-1.5 h-7">
                            <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
                            <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" style={{ animationDelay: "300ms" }} />
                        </div>
                    ) : isTable ? (
                        <TestCaseTable data={tableData} onCopy={onCopy} onDownload={onDownload} onRegenerate={onRegenerate} />
                    ) : (
                        <div className="whitespace-pre-wrap leading-7 text-[15px]">{content}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function InputBox({ value, onChange, onSend, disabled, inputRef, models, selectedModel, setSelectedModel, isJiraMode, setIsJiraMode }: any) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        if (inputRef.current) {
            inputRef.current.style.height = "24px";
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
        }
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6 z-10 w-full">
            <div className="max-w-4xl mx-auto px-4 md:px-6 w-full flex flex-col gap-2">
                
                {/* Toolbar */}
                <div className="flex justify-between items-center px-1 mb-1">
                   {/* Model Selector */}
                   <div className="relative">
                       <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm transition-colors font-medium">
                           <Bot className="w-4 h-4 text-[#10A37F]" />
                           {selectedModel || "Detecting..."}
                           <ChevronDown className="w-3.5 h-3.5" />
                       </button>
                       <AnimatePresence>
                           {isDropdownOpen && (
                               <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[160px] z-50">
                                   {models?.map((m: string) => (
                                       <button key={m} onClick={() => { setSelectedModel(m); setIsDropdownOpen(false); }} className={cn("w-full text-left px-3 py-2 text-sm rounded-md transition-colors", m === selectedModel ? "bg-[#10A37F] text-white" : "text-gray-700 hover:bg-gray-100")}>
                                           {m}
                                       </button>
                                   ))}
                                   {(!models || models.length === 0) && (
                                       <div className="px-3 py-2 text-sm text-gray-400">Loading API...</div>
                                   )}
                               </motion.div>
                           )}
                       </AnimatePresence>
                   </div>

                   {/* Jira Toggle */}
                   <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
                       <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                       <span className="text-sm font-medium text-gray-600">Jira Link</span>
                       <button onClick={() => setIsJiraMode(!isJiraMode)} className={cn("w-8 h-4 rounded-full transition-colors relative flex items-center", isJiraMode ? "bg-blue-500" : "bg-gray-200")}>
                           <motion.div layout animate={{ x: isJiraMode ? 16 : 2 }} className="w-3 h-3 bg-white rounded-full shadow-sm" />
                       </button>
                   </div>
                </div>

                <div className="relative flex items-end w-full bg-white rounded-xl border border-gray-300 shadow-[0_0_15px_rgba(0,0,0,0.05)] focus-within:shadow-[0_0_15px_rgba(0,0,0,0.1)] transition-shadow">
                    <textarea
                        ref={inputRef}
                        value={value}
                        onChange={handleInput}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                onSend();
                            }
                        }}
                        placeholder={isJiraMode ? "Paste Jira Ticket URL..." : "Send a message..."}
                        className="w-full bg-transparent text-gray-800 placeholder-gray-400 m-0 border-0 outline-none resize-none py-3.5 pl-4 pr-12 text-[15px] max-h-[200px]"
                        rows={1}
                        style={{ height: "52px" }}
                    />
                    <button
                        onClick={onSend}
                        disabled={disabled || !value.trim()}
                        className="absolute right-3 bottom-2.5 p-1.5 rounded-md text-white bg-[#10A37F] hover:bg-[#1A7F66] transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-100"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-center text-xs text-gray-500 mt-2 font-sans">
                    AI Test Case Generator can make mistakes. Consider verifying important information.
                </div>
            </div>
        </div>
    );
}

// --- Main App Function ---

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

        fetch("/api/models")
            .then(res => res.json())
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

    const saveHistory = (items: HistoryItem[]) => {
        setHistory(items);
        localStorage.setItem("testgen-history", JSON.stringify(items));
    };

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
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: currentPrompt, model: selectedModel }),
            });
            const data = await res.json();

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

    // Derived states
    const currentThread = history.find(h => h.id === activeId);

    // Helpers
    const copyTableData = () => {
        if (!currentThread?.result) return;
        const text = currentThread.result.testCases.map(tc => 
            `ID: ${tc.id}\nTitle: ${tc.title}\nSteps: ${tc.steps}\nExpected: ${tc.expectedResult}\nPriority: ${tc.priority || "N/A"}`
        ).join("\n\n---\n\n");
        navigator.clipboard.writeText(text);
    };

    const downloadExcelData = () => {
        if (!currentThread?.result?.testCases) return;
        
        // Strictly map to prevent hallucinated arbitrary keys from ruining Excel columns
        const strictData = currentThread.result.testCases.map((tc: any) => ({
             "ID": tc.id || "",
             "Title": tc.title || "",
             "Description": tc.description || "",
             "Steps": tc.steps || "",
             "Expected Result": tc.expectedResult || "",
             "Priority": tc.priority || ""
        }));

        const worksheet = XLSX.utils.json_to_sheet(strictData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "TestCases");
        XLSX.writeFile(workbook, "testcases.xlsx");
    };

    return (
        <div className="flex h-screen bg-white text-gray-800 overflow-hidden font-sans w-full">
            
            {/* Sidebar Component */}
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

            {/* Settings Modal */}
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

            {/* Main Area */}
            <div className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
                
                {/* Header (Mobile / Standard) */}
                <header className="h-14 border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 bg-white z-10 shrink-0 shadow-sm w-full">
                    <div className="flex items-center">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 mr-2 hover:bg-gray-100 rounded-md text-gray-500 md:hidden">
                            <Menu className="w-5 h-5" />
                        </button>
                        <h1 className="font-semibold text-[15px] sm:text-base text-gray-800">testGen-AI</h1>
                    </div>
                </header>

                {/* Content Stream */}
                <div className="flex-1 overflow-y-auto w-full scroll-smooth flex flex-col pb-40 text-sm md:text-base">
                    
                    {!currentThread && !loading ? (
                        /* Empty State */
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center px-4 w-full h-full">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                                <Bot className="w-8 h-8 text-gray-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">How can I help you today?</h2>
                            <p className="text-gray-500">Describe your feature to instantly generate test cases.</p>
                        </motion.div>
                    ) : (
                        /* Chat Stream */
                        <div className="w-full flex flex-col">
                            {/* If we have a completed thread, render it */}
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
                                            onCopy={copyTableData} 
                                            onDownload={downloadExcelData} 
                                            onRegenerate={() => handleSend(currentThread.prompt, true)}
                                        />
                                    ) : null}
                                </>
                            )}

                            {/* If loading and not attached to a visible completed thread yet, show loading bubbles */}
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

                {/* Input Area Component */}
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
                />

            </div>
        </div>
    );
}
