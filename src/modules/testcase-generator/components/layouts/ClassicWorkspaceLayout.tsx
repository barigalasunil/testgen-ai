"use client";

import { cn } from "@/lib/utils";
import { Sidebar } from "../Sidebar";
import { ChatMessage } from "../ChatMessage";
import { JiraPanel } from "../JiraPanel";
import JiraModal from "../JiraModal";
import { useTCGenWorkspace } from "../../hooks/useTCGenWorkspace";
import { AutomationSidebarContent } from "../AutomationSidebarContent";
import { ApiTestingWorkspace } from "@/src/modules/api-testing/ApiTestingWorkspace";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Settings, 
  AlertCircle,
  Plus,
  Send
} from "lucide-react";

interface LayoutProps {
    workspace: ReturnType<typeof useTCGenWorkspace>;
}

export function ClassicWorkspaceLayout({ workspace }: LayoutProps) {
    const {
        value, setValue,
        loading,
        sessions,
        activeId,
        isSidebarOpen, setIsSidebarOpen,
        activePanel, setActivePanel,
        generatingPrompt,
        generationModelStatus,
        progressLabel,
        generationProgress,
        generationFailed,
        models,
        selectedModel, setSelectedModel,
        provider, setProvider,
        providerStatus,
        providerStatusInfo,
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
        attachedDocuments,
        handleAttachDocuments,
        handleRemoveAttachment,
        saveProvider,
        saveModel
    } = workspace;

    const providerOptions = [
        { value: 'auto', label: 'Auto' },
        { value: 'nvidia', label: 'NVIDIA' },
        { value: 'openrouter', label: 'OpenRouter' },
        { value: 'groq', label: 'Groq' },
        { value: 'opencode', label: 'OpenCode' },
        { value: 'ollama', label: 'Ollama Local' },
    ] as const;
    const platformOptions = ['web', 'api', 'mobile'] as const;

    const statusClasses = providerStatusInfo.status === 'fallback'
        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/30'
        : providerStatus === 'connected'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/30'
            : providerStatus === 'connecting'
                ? 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/30';
    const statusDotClass = providerStatusInfo.status === 'fallback'
        ? 'bg-yellow-500'
        : providerStatus === 'connected'
            ? 'bg-green-500'
            : providerStatus === 'connecting'
                ? 'bg-slate-400'
                : 'bg-red-500';

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
            <Sidebar
                history={sessions}
                activeId={activeId}
                activePanel={activePanel}
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
                        <div className={cn("flex max-w-[300px] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", statusClasses)}>
                            <span className={cn("h-2 w-2 rounded-full", statusDotClass)} />
                            <span className="truncate">
                                {providerStatusInfo.message}
                                {providerStatusInfo.model ? ` - ${providerStatusInfo.model}` : ''}
                            </span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                        {/* Status bar */}
                        {loading && (
                            <div className={cn(
                                "absolute top-0 left-0 right-0 z-20 text-white text-[11px] font-bold py-1.5 px-4 flex items-center justify-between shadow-md",
                                providerStatusInfo.status === 'fallback' ? "bg-yellow-500" : "bg-[#2563eb]"
                            )}>
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    {progressLabel}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="opacity-80">Provider: {provider.toUpperCase()}</span>
                                    <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-white transition-all duration-500"
                                            style={{ width: `${generationProgress}%` }}
                                        />
                                    </div>
                                    <span className="tabular-nums">{generationProgress}%</span>
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

                            {activePanel === 'api-testing' && (
                                <ApiTestingWorkspace />
                            )}

                            {activePanel === 'jira' && (
                                <div className="p-4 md:p-8 max-w-5xl mx-auto">
                                    <div className="mb-6 flex items-center justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage AI providers and Jira credentials.</p>
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
                                                        {currentThread.error ? (
                                                            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-5 text-sm text-red-700 dark:text-red-300 shadow-sm">
                                                                <div className="flex items-start gap-3">
                                                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-semibold">Generation failed</p>
                                                                        <p className="mt-1 text-red-600 dark:text-red-300">{currentThread.error}</p>
                                                                        <button
                                                                            onClick={() => handleSend(currentThread.prompt, currentThread.aiOptions)}
                                                                            disabled={loading}
                                                                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
                                                                        >
                                                                            <RefreshCw className="h-3.5 w-3.5" />
                                                                            Retry
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden min-h-[400px]">
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
                                                            </div>
                                                        )}
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
                                    {loading && generatingPrompt && (
                                        <div className={cn(
                                            "mb-3 rounded-xl border bg-white dark:bg-gray-900 p-3 shadow-lg",
                                            generationFailed
                                                ? "border-red-200 dark:border-red-900/50"
                                                : providerStatusInfo.status === 'fallback'
                                                    ? "border-yellow-200 dark:border-yellow-900/50"
                                                    : "border-blue-200 dark:border-blue-900/50"
                                        )}>
                                            <div className="flex items-center justify-between gap-3 text-xs">
                                                <div className="min-w-0">
                                                    <p className={cn(
                                                        "font-bold",
                                                        providerStatusInfo.status === 'fallback' ? "text-yellow-700 dark:text-yellow-300" : "text-blue-700 dark:text-blue-300"
                                                    )}>
                                                        {generationModelStatus} - {generationProgress}%
                                                    </p>
                                                    <p className="mt-1 truncate text-gray-500 dark:text-gray-400">Current step: {progressLabel}</p>
                                                </div>
                                                <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-300" />
                                            </div>
                                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-500",
                                                        providerStatusInfo.status === 'fallback' ? "bg-yellow-500" : "bg-blue-600"
                                                    )}
                                                    style={{ width: `${generationProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {attachedDocuments.length > 0 && (
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            {attachedDocuments.map((doc) => (
                                                <span key={doc.name} className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 shadow-sm">
                                                    {doc.name}
                                                    <button onClick={() => handleRemoveAttachment(doc.name)} className="text-gray-400 hover:text-red-500" title="Remove attachment">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="relative flex w-full flex-col rounded-3xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg focus-within:border-[#10A37F] focus-within:ring-2 focus-within:ring-[#10A37F]/10 transition-all">
                                        <textarea
                                            ref={textareaRef}
                                            value={value}
                                            onChange={(e) => {
                                                setValue(e.target.value);
                                                if(textareaRef.current) {
                                                    textareaRef.current.style.height = "56px";
                                                    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                            placeholder="Ask TCGen-Buddy to generate test cases..."
                                            className="w-full resize-none border-0 bg-transparent px-5 pb-2 pt-4 text-[15px] text-gray-800 dark:text-gray-200 outline-none placeholder-gray-400"
                                            rows={1}
                                            disabled={loading}
                                            style={{ height: "56px" }}
                                        />
                                        <div className="flex items-center justify-between gap-2 px-3 pb-3">
                                            <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-700" title="Attach document">
                                                <Plus className="h-4 w-4" />
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept=".pdf,.docx,.txt,.md,.json,.yaml,.yml"
                                                    className="hidden"
                                                    onChange={(event) => {
                                                        if (event.target.files) {
                                                            handleAttachDocuments(event.target.files);
                                                            event.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={provider}
                                                    onChange={(e) => {
                                                        const nextProvider = e.target.value as typeof provider;
                                                        setProvider(nextProvider);
                                                        saveProvider(nextProvider);
                                                    }}
                                                    className="h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 text-xs font-bold text-gray-600 dark:text-gray-300 outline-none focus:ring-1 focus:ring-[#10A37F]"
                                                >
                                                    {providerOptions.map(option => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={platformType}
                                                    onChange={(e) => setPlatformType(e.target.value as typeof platformType)}
                                                    className="h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 text-xs font-bold text-gray-600 dark:text-gray-300 outline-none focus:ring-1 focus:ring-[#10A37F]"
                                                >
                                                    {platformOptions.map(option => (
                                                        <option key={option} value={option}>{option.toUpperCase()}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={selectedModel}
                                                    onChange={(e) => { setSelectedModel(e.target.value); saveModel(e.target.value); }}
                                                    className="hidden h-9 max-w-[170px] rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 text-xs font-bold text-gray-600 dark:text-gray-300 outline-none focus:ring-1 focus:ring-[#10A37F] sm:block"
                                                >
                                                    <option value="auto">Auto Model</option>
                                                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                                <button
                                                    onClick={() => handleSend()}
                                                    disabled={loading || !value.trim()}
                                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#10A37F] text-white shadow-md transition-all hover:bg-[#10A37F]/90 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-800 active:scale-95"
                                                    title="Send"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            </div>
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
