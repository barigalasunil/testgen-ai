"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  MessageSquare, 
  Zap, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  FileText,
  BarChart3,
  Bot,
  User,
  Send,
  MoreVertical,
  Paperclip,
  Globe,
  Monitor,
  Cpu,
  Trash,
  Edit2,
  Check,
  X,
  Play,
  LayoutDashboard,
  History as HistoryIcon
} from "lucide-react";
import { ChatMessage } from "../ChatMessage";
import JiraModal from "../JiraModal";
import { JiraPanel } from "../JiraPanel";
import { AutomationSidebarContent } from "../AutomationSidebarContent";
import { useTCGenWorkspace } from "../../hooks/useTCGenWorkspace";

interface LayoutProps {
    workspace: ReturnType<typeof useTCGenWorkspace>;
    controls: React.ReactNode;
}

export function MaterialWorkspaceLayout({ workspace, controls }: LayoutProps) {
    const {
        value, setValue,
        loading,
        sessions,
        activeId,
        isSidebarOpen, setIsSidebarOpen,
        activePanel, setActivePanel,
        generatingPrompt,
        generationModelStatus,
        resultTab, setResultTab,
        progressLabel,
        models,
        selectedModel, setSelectedModel,
        provider, setProvider,
        providerStatus,
        platformType, setPlatformType,
        scriptCode,
        scriptFileName,
        isGeneratingScript,
        isRunningAutomation,
        executionLogs,
        executionSummary,
        passedTests,
        failedTests,
        headed, setHeaded,
        reportUrl,
        automationError,
        jiraModalOpen, setJiraModalOpen,
        jiraTargetCase,
        textareaRef,
        messagesEndRef,
        currentThread,
        automationState,
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
    } = workspace;

    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editSessionValue, setEditSessionValue] = useState("");
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    const isTestCases = activePanel === 'testcases';
    const isAutomation = activePanel === 'automation';
    const isJira = activePanel === 'jira';

    const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = "60px";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
        }
    };

    const startRename = (id: string, title: string) => {
        setEditingSessionId(id);
        setEditSessionValue(title);
        setMenuOpenId(null);
    };

    const saveRename = (id: string) => {
        if (editSessionValue.trim()) {
            handleRename(id, editSessionValue);
        }
        setEditingSessionId(null);
    };

    return (
        <div className="flex h-screen bg-[#f0f4f9] dark:bg-[#0f1114] text-[#1f1f1f] dark:text-[#e3e3e3] overflow-hidden font-sans">
            {/* Left Sidebar - Material Style */}
            <aside className={cn(
                "bg-[#f0f4f9] dark:bg-[#0f1114] flex flex-col transition-all duration-300 ease-in-out shrink-0",
                isSidebarOpen ? "w-[280px]" : "w-16"
            )}>
                {/* Burger / Toggle */}
                <div className="p-4 flex items-center">
                   <button 
                     onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                     className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                   >
                     {isSidebarOpen ? <ChevronLeft className="w-5 h-5 text-[#444746] dark:text-[#a0a0a0]" /> : <ChevronRight className="w-5 h-5 text-[#444746] dark:text-[#a0a0a0]" />}
                   </button>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-3">
                   {/* New Chat Button */}
                   <button 
                     onClick={handleNewChat}
                     className={cn(
                       "flex items-center gap-3 rounded-xl p-3 transition-colors mb-6 shadow-sm border border-transparent hover:border-[#e3e3e3] dark:hover:border-[#333]",
                       isSidebarOpen ? "bg-[#dde3ea] dark:bg-[#2a2d32] hover:bg-[#d3d9e1] dark:hover:bg-[#33383e] pr-6" : "bg-[#dde3ea] dark:bg-[#2a2d32] hover:bg-[#d3d9e1] dark:hover:bg-[#33383e] w-10 h-10 justify-center p-0"
                     )}
                   >
                     <Plus className="w-5 h-5 text-[#041e49] dark:text-[#d3e3fd]" />
                     {isSidebarOpen && <span className="text-sm font-medium text-[#041e49] dark:text-[#d3e3fd]">New Workspace</span>}
                   </button>

                   {/* TOP SECTION: Chat History */}
                   <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                        {isSidebarOpen && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mb-4">
                            <p className="text-xs font-semibold px-3 py-2 text-[#444746] dark:text-[#a0a0a0] uppercase tracking-wider">Recent</p>
                            {sessions.length === 0 && <p className="px-3 py-2 text-[#444746] dark:text-[#808080] text-sm italic">No recent chats</p>}
                            {sessions.map(session => (
                            <div key={session.id} className="relative group">
                                {editingSessionId === session.id ? (
                                    <div className="flex items-center gap-1 px-2 py-1">
                                        <input 
                                            autoFocus
                                            value={editSessionValue}
                                            onChange={(e) => setEditSessionValue(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && saveRename(session.id)}
                                            className="flex-1 bg-white dark:bg-[#1a1a1a] border border-[#1a73e8] dark:border-[#64b5f6] rounded-md px-2 py-1 text-sm outline-none text-gray-900 dark:text-white"
                                        />
                                        <button onClick={() => saveRename(session.id)} className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 rounded text-green-600"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setEditingSessionId(null)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                ) : (
                                    <div className={cn(
                                        "flex items-center group rounded-full text-sm transition-colors mb-0.5",
                                        activeId === session.id ? "bg-[#d3e3fd] dark:bg-[#d3e3fd]/10 text-[#041e49] dark:text-[#d3e3fd]" : "hover:bg-black/5 dark:hover:bg-white/5"
                                    )}>
                                        <button 
                                                onClick={() => handleSelectChat(session.id)}
                                                className="flex-1 text-left px-3 py-2 truncate transition-colors"
                                            >
                                                {session.title || 'Untitled Workspace'}
                                            </button>
                                            <div className="opacity-0 group-hover:opacity-100 flex items-center pr-2">
                                                <button 
                                                    onClick={() => setMenuOpenId(menuOpenId === session.id ? null : session.id)}
                                                    className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full"
                                                >
                                                    <MoreVertical className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            {menuOpenId === session.id && (
                                                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1e2124] border border-[#e3e3e3] dark:border-[#333] rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
                                                    <button 
                                                        onClick={() => startRename(session.id, session.title || '')}
                                                        className="w-full text-left px-3 py-1.5 hover:bg-[#f0f4f9] dark:hover:bg-white/5 flex items-center gap-2"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" /> Rename
                                                    </button>
                                                    <button 
                                                        onClick={() => { handleDelete(session.id); setMenuOpenId(null); }}
                                                        className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 flex items-center gap-2"
                                                    >
                                                        <Trash className="w-3.5 h-3.5" /> Delete
                                                    </button>
                                                </div>
                                            )}
                                    </div>
                                )}
                            </div>
                            ))}
                        </div>
                        )}
                   </div>

                   {/* BOTTOM SECTION: Navigation Modules */}
                   <nav className="space-y-1 mb-4 mt-auto border-t border-black/5 dark:border-white/5 pt-4">
                      <NavItem 
                        icon={MessageSquare} 
                        label="Test Case Gen" 
                        active={isTestCases} 
                        collapsed={!isSidebarOpen} 
                        onClick={() => setActivePanel('testcases')}
                      />
                      <NavItem 
                        icon={Zap} 
                        label="Automation" 
                        active={isAutomation} 
                        collapsed={!isSidebarOpen} 
                        onClick={() => setActivePanel('automation')}
                      />
                      <NavItem 
                        icon={Settings} 
                        label="Jira Settings" 
                        active={isJira} 
                        collapsed={!isSidebarOpen} 
                        onClick={() => setActivePanel('jira')}
                      />
                      <NavItem 
                        icon={BarChart3} 
                        label="Reports" 
                        active={false} 
                        collapsed={!isSidebarOpen} 
                        onClick={() => {}}
                      />
                      <NavItem 
                        icon={HistoryIcon} 
                        label="History" 
                        active={false} 
                        collapsed={!isSidebarOpen} 
                        onClick={() => {}}
                      />
                   </nav>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#131314] md:m-3 md:rounded-[24px] shadow-sm border border-[#e3e3e3] dark:border-[#333] overflow-hidden relative transition-colors duration-200">
                
                {/* Floating Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-[#f0f4f9] dark:border-[#333] z-20 bg-white/80 dark:bg-[#131314]/80 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">
                            {isTestCases ? (currentThread?.title || 'TCGen Buddy') : isAutomation ? 'Automation Workspace' : 'Jira Traceability'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Compact Provider Toggle */}
                        <div className="bg-[#f0f4f9] dark:bg-[#1e1f20] rounded-full p-1 hidden sm:flex items-center gap-1">
                           {(['local', 'auto', 'cloud'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => {
                                        if (p === 'auto') return;
                                        setProvider(p);
                                        saveProvider(p);
                                    }}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-bold rounded-full transition-all",
                                        provider === p
                                            ? "bg-white dark:bg-slate-700 text-[#1a73e8] dark:text-[#64b5f6] shadow-sm"
                                            : "text-[#444746] dark:text-[#a0a0a0] hover:bg-black/5 dark:hover:bg-white/5"
                                    )}
                                >
                                    {p.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {/* Connection Indicator */}
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border",
                            providerStatus === 'connected' ? "bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30" : 
                            providerStatus === 'error' ? "bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30" : 
                            "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30"
                        )}>
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                providerStatus === 'connected' ? "bg-green-500" : providerStatus === 'error' ? "bg-red-500" : "bg-amber-500 animate-pulse"
                            )} />
                            <span className="hidden lg:inline">{providerStatus === 'connected' ? 'Online' : providerStatus === 'error' ? 'Offline' : 'Connecting'}</span>
                        </div>

                        {controls}
                    </div>
                </header>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Content Panels */}
                    {isAutomation && (
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                            <div className="max-w-6xl mx-auto space-y-8">
                                <div className="bg-[#f8fafd] dark:bg-[#1e1f20]/30 rounded-[32px] p-4 md:p-8 border border-[#e3e3e3] dark:border-[#333] shadow-sm">
                                    <AutomationSidebarContent
                                        automation={automationState}
                                        onExecuteSuite={handleExecuteSuite}
                                        scriptCode={scriptCode}
                                        hasTestCases={!!(currentThread?.result?.testCases?.length)}
                                        onGenerateScript={handleGenerateScript}
                                        onRunAutomation={handleRunGeneratedScript}
                                        onCopyScript={handleCopyScript}
                                        onDownloadScript={handleDownloadScript}
                                        isGeneratingScript={isGeneratingScript}
                                        isRunningAutomation={isRunningAutomation}
                                        executionLogs={executionLogs}
                                        executionSummary={executionSummary}
                                        passedTests={passedTests}
                                        failedTests={failedTests}
                                        headed={headed}
                                        onHeadedChange={setHeaded}
                                        reportUrl={reportUrl}
                                        platformType={platformType}
                                    />
                                </div>
                                {automationError && (
                                    <div className="rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-8 py-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-3">
                                        <X className="w-5 h-5" />
                                        {automationError}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isJira && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="max-w-5xl mx-auto p-8">
                                <JiraPanel />
                            </div>
                        </div>
                    )}

                    {isTestCases && (
                        <div className="flex-1 flex flex-col min-h-0 relative">
                            {/* Scrollable Chat History */}
                            <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
                                <div className="max-w-4xl mx-auto space-y-12">
                                    {currentThread?.prompt ? (
                                        <div className="flex gap-6">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                                                <User className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                                            </div>
                                            <div className="flex-1 text-[#1f1f1f] dark:text-[#e3e3e3] leading-relaxed pt-1.5 text-lg">
                                                {currentThread.prompt}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-24 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                            <div className="w-20 h-20 bg-[#f0f4f9] dark:bg-[#1e1f20] rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-white dark:ring-[#2a2a2a]">
                                                <Bot className="w-10 h-10 text-[#1a73e8] dark:text-[#64b5f6]" />
                                            </div>
                                            <div className="space-y-4">
                                                <h3 className="text-4xl font-medium tracking-tight text-[#1f1f1f] dark:text-[#e3e3e3]">Welcome to TCGen Buddy</h3>
                                                <p className="text-[#444746] dark:text-[#a0a0a0] text-lg max-w-lg mx-auto leading-relaxed">
                                                    I can help you transform requirements into robust test cases and automation scripts in seconds.
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap justify-center gap-3 mt-8">
                                                {['Generate Login tests', 'Create API validation for /users', 'Mobile smoke test for Checkout'].map(tip => (
                                                    <button 
                                                        key={tip}
                                                        onClick={() => setValue(tip)}
                                                        className="px-6 py-2.5 rounded-full border border-[#e3e3e3] dark:border-[#333] bg-white dark:bg-[#1e1f20] text-sm text-[#444746] dark:text-[#a0a0a0] hover:bg-[#f0f4f9] dark:hover:bg-white/5 transition-colors shadow-sm"
                                                    >
                                                        {tip}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {currentThread && (currentThread.result || currentThread.error) && (
                                        <div className="flex gap-6 animate-in fade-in duration-500">
                                            <div className="w-10 h-10 rounded-full bg-[#f0f4f9] dark:bg-[#1e1f20] flex items-center justify-center shrink-0 border border-[#e3e3e3] dark:border-[#333] shadow-sm">
                                                <Bot className="w-6 h-6 text-[#1a73e8] dark:text-[#64b5f6]" />
                                            </div>
                                            <div className="flex-1 space-y-8 pt-1.5">
                                                {/* Tabs for Results */}
                                                <div className="flex gap-1 bg-[#f0f4f9] dark:bg-[#1e1f20] p-1 rounded-full w-fit border border-[#e3e3e3] dark:border-[#333]">
                                                    {(['testCases', 'scripts', 'logs'] as const).map((tab) => (
                                                        <button 
                                                            key={tab} 
                                                            onClick={() => setResultTab(tab)}
                                                            className={cn(
                                                                "px-6 py-2 rounded-full text-xs font-semibold transition-all",
                                                                resultTab === tab ? "bg-white dark:bg-slate-700 text-[#1a73e8] dark:text-[#64b5f6] shadow-sm" : "text-[#444746] dark:text-[#a0a0a0] hover:bg-black/5 dark:hover:bg-white/5"
                                                            )}
                                                        >
                                                            {tab === 'testCases' ? 'Test Cases' : tab === 'scripts' ? 'Scripts' : 'Execution Logs'}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="bg-white dark:bg-[#1e1f20]/50 rounded-[32px] border border-[#e3e3e3] dark:border-[#333] p-1 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                    {resultTab === 'testCases' && currentThread.result && (
                                                        <ChatMessage
                                                            role="assistant"
                                                            isTable
                                                            tableData={currentThread.result || undefined}
                                                            jiraStoryId={currentThread.aiOptions?.jiraStoryId || ''}
                                                            platformType={currentThread.platform}
                                                            onCopy={copyTableData}
                                                            onRegenerate={() => handleSend(currentThread.prompt, currentThread.aiOptions)}
                                                            onGenerateScript={handleGenerateScript}
                                                            onRunAutomation={handleRunGeneratedScript}
                                                            onCopyScript={handleCopyScript}
                                                            onDownloadScript={handleDownloadScript}
                                                            hasGeneratedScript={!!scriptCode}
                                                            isGeneratingScript={isGeneratingScript}
                                                            isRunningAutomation={isRunningAutomation}
                                                            onOpenJira={handleOpenJira}
                                                        />
                                                    )}

                                                    {resultTab === 'scripts' && (
                                                        <div className="p-6 md:p-8">
                                                            {scriptCode ? (
                                                                <div className="space-y-6">
                                                                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f0f4f9] dark:border-[#333] pb-6">
                                                                        <div>
                                                                            <h4 className="font-semibold text-lg text-[#1f1f1f] dark:text-[#e3e3e3]">Playwright Script</h4>
                                                                            <p className="text-[#444746] dark:text-[#a0a0a0] text-sm mt-1 flex items-center gap-2">
                                                                                <FileText className="w-4 h-4 text-[#1a73e8] dark:text-[#64b5f6]" />
                                                                                {scriptFileName}
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex gap-3">
                                                                            <button 
                                                                                onClick={handleCopyScript} 
                                                                                className="flex items-center gap-2 border border-[#e3e3e3] dark:border-[#333] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#f0f4f9] dark:hover:bg-white/5 transition-colors dark:text-[#e3e3e3]"
                                                                            >
                                                                                <Plus className="w-4 h-4" /> Copy
                                                                            </button>
                                                                            <button 
                                                                                onClick={handleRunGeneratedScript} 
                                                                                disabled={isRunningAutomation} 
                                                                                className="flex items-center gap-2 bg-[#1a73e8] dark:bg-[#1a73e8] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#1557b0] transition-all shadow-md active:scale-95 disabled:opacity-50"
                                                                            >
                                                                                <Play className="w-4 h-4 fill-current" />
                                                                                {isRunningAutomation ? 'Executing...' : 'Run Automation'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <pre className="whitespace-pre-wrap break-words rounded-[20px] bg-[#f8fafd] dark:bg-[#131416] p-6 text-[13px] text-[#1f1f1f] dark:text-[#d1d1d1] border border-[#e3e3e3] dark:border-[#333] overflow-auto max-h-[500px] font-mono leading-relaxed shadow-inner">{scriptCode}</pre>
                                                                </div>
                                                            ) : (
                                                                <div className="py-20 text-center space-y-4">
                                                                    <div className="w-16 h-16 bg-[#f0f4f9] dark:bg-[#1e1f20] rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                                        <FileText className="w-8 h-8 text-[#dde3ea] dark:text-[#444746]" />
                                                                    </div>
                                                                    <p className="text-[#444746] dark:text-[#a0a0a0] text-lg font-medium">No script generated yet</p>
                                                                    <p className="text-[#444746] dark:text-[#808080] text-sm max-w-xs mx-auto">Generate test cases first, then use the Automation tab to create your script.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {resultTab === 'logs' && (
                                                        <div className="p-8">
                                                            {executionLogs.length > 0 ? (
                                                                <div className="space-y-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">Live Execution Logs</h4>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                                            <span className="text-xs font-medium text-[#444746] dark:text-[#a0a0a0]">Capturing console output</span>
                                                                        </div>
                                                                    </div>
                                                                    <pre className="whitespace-pre-wrap break-words rounded-[20px] bg-[#1e1e1e] p-6 text-[13px] text-[#d1d1d1] border border-[#333] overflow-auto max-h-[500px] font-mono shadow-2xl">{executionLogs.join("\n")}</pre>
                                                                </div>
                                                            ) : (
                                                                <div className="py-20 text-center space-y-4">
                                                                    <BarChart3 className="w-16 h-16 text-[#dde3ea] dark:text-[#444746] mx-auto mb-2" />
                                                                    <p className="text-[#444746] dark:text-[#a0a0a0] text-lg font-medium">No activity logged</p>
                                                                    <p className="text-[#444746] dark:text-[#808080] text-sm">Execution metrics and console logs will appear here during automation runs.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} className="h-48" />
                                </div>
                            </div>

                            {/* Bottom Fixed Prompt Area */}
                            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-white via-white dark:from-[#131314] dark:via-[#131314] to-transparent pt-16 z-10 transition-colors duration-200">
                                <div className="max-w-4xl mx-auto relative group">
                                    {loading && (
                                       <div className="absolute -top-12 left-6 right-6 flex items-center gap-4 bg-white/50 dark:bg-[#1e1f20]/50 backdrop-blur-sm p-2 rounded-full w-fit border border-[#e3e3e3] dark:border-[#333] shadow-sm">
                                          <div className="flex gap-1 pl-2">
                                             <div className="w-2 h-2 rounded-full bg-[#1a73e8] animate-bounce [animation-delay:-0.3s]" />
                                             <div className="w-2 h-2 rounded-full bg-[#1a73e8] animate-bounce [animation-delay:-0.15s]" />
                                             <div className="w-2 h-2 rounded-full bg-[#1a73e8] animate-bounce" />
                                          </div>
                                          <span className="text-sm font-semibold text-[#1a73e8] dark:text-[#64b5f6] pr-4">{progressLabel}</span>
                                       </div>
                                    )}
                                    
                                    <div className={cn(
                                        "bg-[#f0f4f9] dark:bg-[#1e1f20] rounded-[32px] p-2 pr-4 shadow-sm border transition-all duration-300 ring-offset-4 ring-transparent",
                                        loading ? "border-[#e3e3e3] dark:border-[#333] opacity-80" : "border-transparent focus-within:bg-white dark:focus-within:bg-[#131314] focus-within:shadow-xl focus-within:border-[#e3e3e3] dark:focus-within:border-[#444] focus-within:ring-[#d3e3fd]/50"
                                    )}>
                                        <div className="flex flex-col">
                                            <textarea
                                                ref={textareaRef}
                                                value={value}
                                                onChange={handleInputResize}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSend();
                                                    }
                                                }}
                                                placeholder="Enter a prompt here..."
                                                className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[60px] max-h-[200px] py-4 px-6 text-lg text-[#1f1f1f] dark:text-[#e3e3e3] placeholder:text-[#444746] dark:placeholder:text-[#808080]"
                                                disabled={loading}
                                            />
                                            <div className="flex items-center justify-between mt-1 pb-2 px-4">
                                                <div className="flex items-center gap-1.5">
                                                    <button className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-[#444746] dark:text-[#a0a0a0] transition-colors" title="Attach"><Paperclip className="w-5 h-5" /></button>
                                                    
                                                    {/* Platform Indicator */}
                                                    <div className="relative group/platform">
                                                        <button 
                                                            onClick={() => setPlatformType(platformType === 'web' ? 'mobile' : platformType === 'mobile' ? 'api' : 'web')}
                                                            className="flex items-center gap-2 bg-[#dde3ea] dark:bg-[#2a2d32] hover:bg-[#d3d9e1] dark:hover:bg-[#33383e] px-4 py-1.5 rounded-full text-[#041e49] dark:text-[#d3e3fd] transition-colors shadow-sm"
                                                        >
                                                            {platformType === 'web' ? <Globe className="w-4 h-4" /> : platformType === 'api' ? <Cpu className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                                                            <span className="text-xs font-bold uppercase tracking-tight">{platformType}</span>
                                                        </button>
                                                    </div>

                                                    <div className="h-6 w-px bg-[#e3e3e3] dark:bg-[#333] mx-1" />

                                                    <select 
                                                        value={selectedModel}
                                                        onChange={(e) => { setSelectedModel(e.target.value); saveModel(e.target.value); }}
                                                        className="bg-transparent text-xs font-bold text-[#444746] dark:text-[#a0a0a0] border-none focus:ring-0 cursor-pointer py-1.5 px-3 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                    >
                                                        <option value="auto">AUTO-MODEL</option>
                                                        {models.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                                                    </select>
                                                </div>
                                                <button 
                                                    onClick={() => handleSend()}
                                                    disabled={loading || !value.trim()}
                                                    className={cn(
                                                        "p-3.5 rounded-full transition-all shadow-md active:scale-90",
                                                        (loading || !value.trim()) ? "bg-[#dde3ea] dark:bg-[#2a2d32] text-[#444746] dark:text-[#555] opacity-30 cursor-not-allowed shadow-none" : "bg-[#1f1f1f] dark:bg-[#e3e3e3] text-white dark:text-[#131314] hover:bg-black dark:hover:bg-white hover:shadow-lg"
                                                    )}
                                                >
                                                    <Send className={cn("w-6 h-6", !loading && value.trim() && "fill-current")} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <p className="text-[11px] text-center text-[#444746] dark:text-[#808080] mt-4 font-medium">
                                        TCGen Buddy provides AI suggestions. Always review scripts before critical execution.
                                    </p>
                                </div>
                            </div>
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

function NavItem({ icon: Icon, label, active, collapsed, onClick }: { icon: any, label: string, active: boolean, collapsed: boolean, onClick: () => void }) {
    return (
        <button 
           onClick={onClick}
           className={cn(
            "w-full flex items-center transition-all duration-300 rounded-full",
            collapsed ? "justify-center h-12 w-12 mx-auto" : "px-5 py-3 gap-4",
            active ? "bg-[#d3e3fd] dark:bg-[#d3e3fd]/10 text-[#041e49] dark:text-[#d3e3fd] shadow-sm" : "hover:bg-black/5 dark:hover:bg-white/5 text-[#444746] dark:text-[#a0a0a0]"
           )}
           title={collapsed ? label : undefined}
        >
            <Icon className={cn("w-5 h-5 shrink-0", active ? "text-[#1a73e8] dark:text-[#64b5f6]" : "text-[#444746] dark:text-[#a0a0a0]")} />
            {!collapsed && <span className="text-sm font-semibold tracking-tight">{label}</span>}
        </button>
    );
}
