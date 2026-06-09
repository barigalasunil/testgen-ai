"use client";

import { cn } from "@/lib/utils";
import { Sidebar } from "../Sidebar";
import { ChatMessage } from "../ChatMessage";
import { JiraPanel } from "../JiraPanel";
import JiraModal from "../JiraModal";
import { useTCGenWorkspace } from "../../hooks/useTCGenWorkspace";
import { AutomationSidebarContent } from "../AutomationSidebarContent";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Settings, 
  Terminal, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

interface LayoutProps {
    workspace: ReturnType<typeof useTCGenWorkspace>;
    controls: React.ReactNode;
}

export function ClassicWorkspaceLayout({ workspace, controls }: LayoutProps) {
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

    const isTestCases = activePanel === 'testcases';

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
            <Sidebar
                history={sessions}
                activeId={activeId}
                activePanel={activePanel as 'testcases' | 'automation' | 'jira'}
                onSelect={handleSelectChat}
                onChangePanel={setActivePanel}
                onNewChat={handleNewChat}
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                loading={loading}
                onRename={handleRename}
                onDelete={handleDelete}
                // Automation props
                automation={automationState}
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
                onCopyScript={handleCopyScript}
                onDownloadScript={handleDownloadScript}
                platformType={platformType}
            />

            <main className={cn(
                "flex-1 flex flex-col min-w-0 transition-all duration-300 relative",
                !isSidebarOpen && "md:ml-0"
            )}>
                {/* Fixed Header */}
                <header className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500"
                        >
                            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                        <h1 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wider truncate max-w-[200px] md:max-w-md">
                            {currentThread?.title || 'TCGen Buddy'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Provider Toggle */}
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 hidden sm:flex border border-gray-200 dark:border-gray-700">
                            {(['local', 'auto', 'cloud'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => {
                                        if (p === 'auto') return;
                                        setProvider(p);
                                        saveProvider(p);
                                    }}
                                    className={cn(
                                        "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                                        provider === p
                                            ? "bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm"
                                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    )}
                                >
                                    {p.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {providerStatus === 'connecting' && (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-semibold animate-pulse border border-amber-100 dark:border-amber-900/30">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Connecting
                            </div>
                        )}
                        {providerStatus === 'connected' && (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-semibold border border-green-100 dark:border-green-900/30">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                Online
                            </div>
                        )}
                        {providerStatus === 'error' && (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-100 dark:border-red-900/30">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Offline
                            </div>
                        )}

                        {controls}
                    </div>
                </header>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                        {/* Status bar */}
                        {loading && (
                            <div className="absolute top-0 left-0 right-0 z-20 bg-[#10A37F] dark:bg-[#10A37F]/80 text-white text-[11px] font-bold py-1.5 px-4 flex items-center justify-between shadow-md">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    {progressLabel}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="opacity-80">Provider: {provider.toUpperCase()}</span>
                                    <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-white animate-[progress_2s_ease-in-out_infinite]" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Panels */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-950 transition-colors duration-200">
                            {activePanel === 'automation' && (
                                <div className="p-4 md:p-8 max-w-7xl mx-auto">
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
                                    {automationError && (
                                        <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            {automationError}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activePanel === 'jira' && (
                                <div className="p-4 md:p-8 max-w-5xl mx-auto">
                                    <div className="mb-6 flex items-center justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Jira Traceability</h2>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configure your Jira integration and traceability rules.</p>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                                        <JiraPanel />
                                    </div>
                                </div>
                            )}

                            {activePanel === 'testcases' && (
                                <div className="flex flex-col min-h-full">
                                    {!currentThread?.prompt ? (
                                        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50 dark:bg-gray-950/50">
                                            <div className="max-w-md w-full text-center space-y-6">
                                                <div className="w-16 h-16 bg-[#10A37F]/10 dark:bg-[#10A37F]/20 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-[#10A37F]/5">
                                                    <Settings className="w-8 h-8 text-[#10A37F]" />
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Start your first workspace</h3>
                                                    <p className="text-gray-500 dark:text-gray-400 text-sm">Enter a prompt below describing a feature, and I'll generate comprehensive test cases for you.</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 pt-2">
                                                    {['"Login form with email and password"', '"Shopping cart checkout flow"', '"User profile API validation"'].map((suggestion) => (
                                                        <button
                                                            key={suggestion}
                                                            onClick={() => setValue(suggestion.replace(/"/g, ''))}
                                                            className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-[#10A37F] hover:bg-white dark:hover:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 transition-all font-medium"
                                                        >
                                                            {suggestion}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto w-full">
                                            {/* User Prompt */}
                                            <div className="flex gap-4 group">
                                                <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0 shadow-sm border border-gray-300 dark:border-gray-700">
                                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">User</span>
                                                </div>
                                                <div className="flex-1 pt-1">
                                                    <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">{currentThread.prompt}</p>
                                                </div>
                                            </div>

                                            {/* Assistant Result */}
                                            {(currentThread.result || currentThread.error) && (
                                                <div className="flex gap-4">
                                                    <div className="w-8 h-8 rounded-lg bg-[#10A37F] flex items-center justify-center shrink-0 shadow-md shadow-[#10A37F]/20">
                                                        <Settings className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div className="flex-1 pt-1 space-y-6">
                                                        {/* Tab system */}
                                                        <div className="flex gap-4 border-b border-gray-100 dark:border-gray-800 overflow-x-auto pb-px scrollbar-none">
                                                            {(['testCases', 'scripts', 'logs'] as const).map((tab) => (
                                                                <button
                                                                    key={tab}
                                                                    onClick={() => setResultTab(tab)}
                                                                    className={cn(
                                                                        "pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative whitespace-nowrap",
                                                                        resultTab === tab 
                                                                            ? "text-[#10A37F]" 
                                                                            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                                                    )}
                                                                >
                                                                    {tab.replace(/([A-Z])/g, ' $1')}
                                                                    {resultTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#10A37F] rounded-full" />}
                                                                </button>
                                                            ))}
                                                        </div>

                                                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden min-h-[400px]">
                                                            {resultTab === 'testCases' && (
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
                                                                <div className="p-6 space-y-6">
                                                                    {scriptCode ? (
                                                                        <>
                                                                            <div className="flex items-center justify-between border-b dark:border-gray-800 pb-4">
                                                                                <div>
                                                                                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-tighter flex items-center gap-2">
                                                                                        <Terminal className="w-4 h-4 text-[#10A37F]" />
                                                                                        {scriptFileName}
                                                                                    </h4>
                                                                                </div>
                                                                                <div className="flex gap-2">
                                                                                    <button onClick={handleCopyScript} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500" title="Copy Script"><Settings className="w-4 h-4" /></button>
                                                                                </div>
                                                                            </div>
                                                                            <pre className="bg-gray-900 rounded-lg p-6 text-[13px] text-gray-300 overflow-auto max-h-[500px] font-mono leading-relaxed border border-gray-800 shadow-inner">{scriptCode}</pre>
                                                                        </>
                                                                    ) : (
                                                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                                                                            <Terminal className="w-12 h-12 opacity-20" />
                                                                            <p className="text-sm font-medium">No script generated. Click 'Generate Script' below the table.</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {resultTab === 'logs' && (
                                                                <div className="p-6">
                                                                    {executionLogs.length > 0 ? (
                                                                        <div className="bg-gray-900 rounded-lg p-6 text-[13px] text-green-400 font-mono overflow-auto max-h-[500px] border border-gray-800 shadow-inner">
                                                                            {executionLogs.map((log, i) => <div key={i} className="mb-0.5 line-clamp-1">{log}</div>)}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                                                                            <Settings className="w-12 h-12 opacity-20" />
                                                                            <p className="text-sm font-medium">Automation logs will appear here when running scripts.</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={messagesEndRef} className="h-40" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Fixed Input area for Test Cases */}
                        {activePanel === 'testcases' && (
                            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-gray-50 dark:from-gray-950 via-gray-50 dark:via-gray-950 to-transparent pt-12 z-20 transition-colors duration-200">
                                <div className="max-w-4xl mx-auto relative">
                                    <div className="relative flex items-end w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-700 shadow-lg focus-within:border-[#10A37F] focus-within:ring-2 focus-within:ring-[#10A37F]/10 transition-all">
                                        <textarea
                                            ref={textareaRef}
                                            value={value}
                                            onChange={(e) => {
                                                setValue(e.target.value);
                                                if(textareaRef.current) {
                                                    textareaRef.current.style.height = "52px";
                                                    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                            placeholder="Describe feature or functionality to generate test cases..."
                                            className="w-full bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 m-0 border-0 outline-none resize-none py-4 px-5 text-[15px] max-h-[200px]"
                                            rows={1}
                                            disabled={loading}
                                            style={{ height: "52px" }}
                                        />
                                        <div className="flex items-center gap-2 pr-3 pb-3">
                                            <select
                                                value={selectedModel}
                                                onChange={(e) => { setSelectedModel(e.target.value); saveModel(e.target.value); }}
                                                className="bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-400 border-none rounded-md px-2 py-1.5 focus:ring-1 focus:ring-[#10A37F]"
                                            >
                                                <option value="auto">AUTO</option>
                                                {models.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                                            </select>
                                            <button
                                                onClick={() => setPlatformType(platformType === 'web' ? 'mobile' : platformType === 'mobile' ? 'api' : 'web')}
                                                className="bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-400 rounded-md px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors uppercase"
                                            >
                                                {platformType}
                                            </button>
                                            <button
                                                onClick={() => handleSend()}
                                                disabled={loading || !value.trim()}
                                                className="p-2 rounded-lg text-white transition-all bg-[#10A37F] hover:bg-[#10A37F]/90 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 shadow-md active:scale-95"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-center text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em]">
                                        TCGen-Buddy • AI Powered Quality Engineering
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
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
