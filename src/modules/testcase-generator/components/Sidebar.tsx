"use client";

import { useState } from "react";
import { Plus, X, Bot, MoreHorizontal, Pencil, Trash, Settings, Zap, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { HistoryItem, SuiteKey, SuiteExecution } from "../types";

interface SidebarProps {
    history: HistoryItem[];
    activeId: string | null;
    activePanel: 'testcases' | 'api-testing' | 'automation' | 'jira';
    onSelect: (id: string) => void;
    onChangePanel: (panel: 'testcases' | 'api-testing' | 'automation' | 'jira') => void;
    onNewChat: () => void;
    isOpen: boolean;
    toggleSidebar: () => void;
    loading: boolean;
    onRename: (id: string, newTitle: string) => void;
    onDelete: (id: string) => void;
    // Automation props (interface defined but not all used in Sidebar UI)
    automation?: Record<SuiteKey, SuiteExecution>;
    onExecuteSuite?: (suite: SuiteKey, headed: boolean) => void;
    hasTestCases?: boolean;
    scriptCode?: string | null;
    isGeneratingScript?: boolean;
    isRunningAutomation?: boolean;
    executionLogs?: string[];
    executionSummary?: { total: number; passed: number; failed: number; durationMs: number; reportUrl?: string } | null;
    passedTests?: string[];
    failedTests?: string[];
    headed?: boolean;
    onHeadedChange?: (val: boolean) => void;
    reportUrl?: string | null;
    onGenerateScript?: () => void;
    onRunAutomation?: () => void;
    onCopyScript?: () => void;
    onDownloadScript?: () => void;
    platformType?: string;
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
    loading,
    onRename,
    onDelete,
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
        { id: 'api-testing', label: 'API Testing', icon: Server },
        { id: 'automation', label: 'Automation Workspace', icon: Zap },
        { id: 'jira', label: 'Settings', icon: Settings },
    ] as const;

    return (
        <div className={cn(
            "fixed md:static inset-y-0 left-0 z-40 bg-[#f9f9f9] dark:bg-[#0d0d0d] border-r border-gray-200 dark:border-gray-800 w-[260px] flex flex-col transition-all duration-300 ease-in-out shrink-0",
            isOpen ? "translate-x-0" : "-translate-x-full hidden md:flex md:translate-x-0"
        )}>
            {/* TOP SECTION: New Chat & History */}
            <div className="p-3 flex flex-col gap-4">
                <div className="flex items-center justify-between md:hidden">
                    <span className="text-sm font-bold dark:text-white">Menu</span>
                    <button onClick={toggleSidebar} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                        <X className="w-5 h-5 dark:text-gray-400" />
                    </button>
                </div>
                
                <button
                    onClick={loading ? undefined : onNewChat}
                    disabled={loading}
                    className={cn(
                        "w-full flex items-center gap-3 rounded-lg p-3 text-sm font-semibold shadow-sm transition-all border",
                        loading 
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700 cursor-not-allowed" 
                            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                    )}
                >
                    <Plus className={cn("w-4 h-4", loading ? "text-gray-400" : "text-[#10A37F]")} /> 
                    New Workspace
                </button>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Recent Sessions List */}
                <div className="flex-1 overflow-y-auto px-2 custom-scrollbar space-y-0.5">
                    <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-3 pt-2">Recent Workspaces</div>
                    {history.length === 0 && <div className="text-gray-400 dark:text-gray-600 text-xs px-3 italic">No history yet.</div>}
                    {history.map((item) => (
                        <div key={item.id} className={cn(
                            "relative flex items-center group w-full rounded-lg transition-all mb-0.5",
                            activeId === item.id ? "bg-gray-200 dark:bg-gray-800" : "hover:bg-gray-100 dark:hover:bg-gray-800/50"
                        )}>
                            {editingId === item.id ? (
                                <input
                                    autoFocus
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => handleSaveTitle(item.id)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveTitle(item.id)}
                                    className="flex-1 min-w-0 bg-white dark:bg-gray-900 py-1.5 px-2.5 text-xs text-gray-900 dark:text-white border-2 border-[#10A37F] rounded-md outline-none mx-1 my-1 shadow-sm"
                                />
                            ) : (
                                <>
                                    <button 
                                        onClick={() => {
                                            onSelect(item.id);
                                            onChangePanel('testcases');
                                        }} 
                                        className={cn(
                                            "flex-1 flex items-center gap-3 p-2.5 text-xs font-semibold text-left truncate overflow-hidden transition-colors",
                                            activeId === item.id ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"
                                        )}
                                    >
                                        <Bot className={cn("w-3.5 h-3.5 shrink-0", activeId === item.id ? "text-[#10A37F]" : "text-gray-400")} />
                                        <span className="truncate">{item.title || 'Untitled Workspace'}</span>
                                    </button>
                                    <div className="relative pr-1.5 shrink-0">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }} 
                                            className={cn("p-1.5 rounded-md text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-opacity", activeId === item.id || openMenuId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                                        >
                                            <MoreHorizontal className="w-3.5 h-3.5" />
                                        </button>
                                        {openMenuId === item.id && (
                                            <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-md shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50">
                                                <button onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditValue(item.title || ''); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                                                    <Pencil className="w-3 h-3" /> Rename
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); setOpenMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                                                    <Trash className="w-3 h-3" /> Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* BOTTOM SECTION: Navigation & Workspaces */}
                <div className="px-3 pb-4 mt-auto border-t border-gray-100 dark:border-gray-800 pt-4 space-y-1">
                    <div className="text-[10px] uppercase tracking-widest text-[#10A37F] font-bold mb-3 px-1">Navigation</div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onChangePanel(item.id as any)}
                            className={cn(
                                "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition-all mb-0.5",
                                activePanel === item.id
                                    ? "bg-[#10A37F]/10 dark:bg-[#10A37F]/20 text-[#10A37F]"
                                    : "text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                            )}
                        >
                            <item.icon className={cn("w-4 h-4 shrink-0 transition-colors", activePanel === item.id ? "text-[#10A37F]" : "text-gray-400")} />
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
