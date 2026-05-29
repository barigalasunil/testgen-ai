"use client";

import { useState } from "react";
import { Plus, X, Bot, MoreHorizontal, Pencil, Trash, MessageSquare, Settings, Brain, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { HistoryItem, SuiteKey, SuiteExecution } from "../types";
import { AutomationSidebarContent } from "./AutomationSidebarContent";

interface SidebarProps {
    history: HistoryItem[];
    activeId: string | null;
    activePanel: 'chat' | 'automation' | 'jira' | 'rag';
    onSelect: (id: string) => void;
    onChangePanel: (panel: 'chat' | 'automation' | 'jira' | 'rag') => void;
    onNewChat: () => void;
    isOpen: boolean;
    toggleSidebar: () => void;
    onOpenSettings: () => void;
    loading: boolean;
    onRename: (id: string, newTitle: string) => void;
    onDelete: (id: string) => void;
    // Automation props
    automation: Record<SuiteKey, SuiteExecution> | undefined;
    onExecuteSuite: (suite: SuiteKey, headed: boolean) => void;
    hasTestCases: boolean;
    scriptCode: string | null;
    isGeneratingScript: boolean;
    isRunningAutomation: boolean;
    executionLogs: string[];
    executionSummary: { total: number; passed: number; failed: number; durationMs: number; reportUrl?: string } | null;
    passedTests: string[];
    failedTests: string[];
    headed: boolean;
    onHeadedChange: (val: boolean) => void;
    reportUrl: string | null;
    onGenerateScript: () => void;
    onRunAutomation: () => void;
    platformType: string;
}

export function Sidebar({
    history,
    activeId,
    activePanel,
    onSelect,
    onChangePanel,
    onNewChat,
    isOpen,
    toggleSidebar,
    onOpenSettings,
    loading,
    onRename,
    onDelete,
    automation,
    onExecuteSuite,
    hasTestCases,
    scriptCode,
    isGeneratingScript,
    isRunningAutomation,
    executionLogs,
    executionSummary,
    passedTests,
    failedTests,
    headed,
    onHeadedChange,
    reportUrl,
    onGenerateScript,
    onRunAutomation,
    platformType,
}: SidebarProps) {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const handleSaveTitle = (id: string) => {
        if(editValue.trim()){
            onRename(id, editValue);
        }
        setEditingId(null);
    };

    const navItems = [
        { id: 'chat', label: 'Chat Workspace', icon: MessageSquare },
        { id: 'automation', label: 'Automation Workspace', icon: Zap },
        { id: 'jira', label: 'Jira Settings', icon: Settings },
        { id: 'rag', label: 'DeepMind RAG', icon: Brain },
    ];

    return (
        <div className={cn(
            "fixed md:static inset-y-0 left-0 z-40 bg-[#f9f9f9] border-r border-gray-200 w-[240px] flex flex-col transition-transform duration-300 ease-in-out shrink-0",
            isOpen ? "translate-x-0" : "-translate-x-full hidden md:flex md:translate-x-0"
        )}>
            {/* New Chat + close */}
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

            {/* Nav entries */}
            <div className="px-2 pb-1">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onChangePanel(item.id as any)}
                        className={cn(
                            "w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors mb-0.5",
                            activePanel === item.id
                                ? "bg-slate-200 text-slate-900"
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        )}
                    >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
                {activePanel === 'chat' && (
                    <>
                        <div className="text-xs font-semibold text-gray-400 mb-2 px-2 py-1.5">Recent Sessions</div>
                        {history.length === 0 && <div className="text-gray-400 text-sm px-2">No history yet.</div>}
                        {history.map((item) => (
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
                    </>
                )}

                {activePanel === 'automation' && (
                    <AutomationSidebarContent
                        automation={automation || { smoke: { status: 'idle' }, sanity: { status: 'idle' }, regression: { status: 'idle' } }}
                        onExecuteSuite={onExecuteSuite}
                        scriptCode={scriptCode}
                        hasTestCases={hasTestCases}
                        onGenerateScript={onGenerateScript}
                        onRunAutomation={onRunAutomation}
                        isGeneratingScript={isGeneratingScript}
                        isRunningAutomation={isRunningAutomation}
                        executionLogs={executionLogs}
                        executionSummary={executionSummary}
                        passedTests={passedTests}
                        failedTests={failedTests}
                        headed={headed}
                        onHeadedChange={onHeadedChange}
                        reportUrl={reportUrl}
                        platformType={platformType}
                    />
                )}

                {activePanel === 'jira' && (
                    <div className="px-3 py-4 text-xs text-slate-500">
                        <p className="font-semibold text-slate-700 mb-2">Jira Integration</p>
                        <p className="text-slate-400 mb-3">Configure Jira connection to fetch stories, push test cases, and create defects.</p>
                        <button onClick={onOpenSettings}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 text-white px-3 py-2 text-[11px] font-semibold hover:bg-slate-700 transition">
                            <Settings className="w-3 h-3" />
                            Open Jira Settings
                        </button>
                    </div>
                )}

                {activePanel === 'rag' && (
                    <div className="px-3 py-4 text-xs text-slate-500">
                        <p className="font-semibold text-slate-700 mb-2">DeepMind RAG</p>
                        <p className="text-slate-400 mb-3">Semantic search across ingested Jira stories, documents, and requirements.</p>
                        <button onClick={() => onChangePanel('rag')}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 text-white px-3 py-2 text-[11px] font-semibold hover:bg-slate-700 transition">
                            <Brain className="w-3 h-3" />
                            Open RAG Workspace
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
