"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Sidebar } from "../Sidebar";
import { ChatMessage } from "../ChatMessage";
import { JiraPanel } from "../JiraPanel";
import JiraModal from "../JiraModal";
import { useTCGenWorkspace } from "../../hooks/useTCGenWorkspace";
import { AutomationSidebarContent } from "../AutomationSidebarContent";
import { ApiTestingWorkspace } from "@/src/modules/api-testing/ApiTestingWorkspace";
import { DefectStudio } from "@/src/modules/defect-studio/DefectStudio";
import { MemoryVaultPanel } from "@/src/modules/memory-vault/MemoryVaultPanel";
import { TraceabilityMatrixPanel } from "@/src/modules/traceability/TraceabilityMatrixPanel";
import { 
  X, 
  RefreshCw, 
  AlertCircle,
  Plus,
  Send,
  Wifi,
  WifiOff,
  Bot
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
        currentSectionHeader,
        generatingPrompt,
        generationModelStatus,
        progressLabel,
        generationProgress,
        generationFailed,
        models,
        modelLoadError,
        selectedModel, setSelectedModel,
        provider, setProvider,
        providerStatusInfo,
        platformType, setPlatformType,
        scriptCode,
        isGeneratingScript,
        isRunningAutomation,
        executionLogs,
        executionSummary,
        passedTests,
        failedTests,
        headed, setHeaded,
        reportUrl,
        automationError,
        automationToast, setAutomationToast,
        automationRuns,
        anySuiteRunning,
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
        copyTestCaseData,
        handleCopyScript,
        handleDownloadScript,
        attachedDocuments,
        handleAttachDocuments,
        handleRemoveAttachment,
        attachedMemoryContext,
        handleUseMemoryAsContext,
        handleClearMemoryContext,
        saveProvider,
        saveModel,
        providerSettings
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

    const isOllama = provider === 'ollama';
    const ollamaHasChatModels = isOllama && Array.isArray(providerStatusInfo.chatModels) && providerStatusInfo.chatModels.length > 0;
    const ollamaReachableNoModels = isOllama && !providerStatusInfo.connected && providerStatusInfo.chatModels && providerStatusInfo.chatModels.length === 0;
    const conversationMessages = currentThread?.messages?.length
        ? currentThread.messages
        : currentThread?.result || currentThread?.error
            ? [{
                id: currentThread.id,
                type: "generated_test_cases" as const,
                title: currentThread.title,
                prompt: currentThread.prompt,
                platform: currentThread.platform,
                result: currentThread.result,
                qualityReport: currentThread.qualityReport,
                error: currentThread.error,
                aiOptions: currentThread.aiOptions,
                aiMeta: currentThread.aiMeta,
                createdAt: currentThread.createdAt,
                updatedAt: currentThread.updatedAt,
            }]
            : [];

    let statusClasses: string;
    let statusText: string;

    if (isOllama && !providerStatusInfo.connected && providerStatusInfo.chatModels) {
        statusClasses = 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/30';
        statusText = `Ollama Local Not Ready — No generation models found`;
    } else if (providerStatusInfo.connected) {
        statusClasses = 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/30';
        const label = providerOptions.find(o => o.value === provider)?.label || 'AI Provider';
        statusText = isOllama
            ? `Ollama Local Online (${providerStatusInfo.chatModels?.length || 0} model${(providerStatusInfo.chatModels?.length || 0) !== 1 ? 's' : ''})`
            : `${label} Online`;
    } else {
        statusClasses = 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/30';
        const label = providerOptions.find(o => o.value === provider)?.label || 'AI Provider';
        statusText = isOllama ? 'Ollama Local Offline' : `${label} Offline`;
    }

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
                <header className="min-h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-4 px-4 py-2 sticky top-0 z-30 shadow-sm">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="hidden shrink-0 items-center gap-2 sm:flex">
                            <Image
                                src="/assets/logo/tcgen-buddy-header-logo.png"
                                alt="TCGen-Buddy"
                                width={32}
                                height={32}
                                priority
                                className="h-8 w-8 rounded-md object-contain"
                            />
                            <span className="hidden text-sm font-extrabold tracking-tight text-gray-900 dark:text-gray-100 lg:inline">
                                TCGen-Buddy
                            </span>
                        </div>
                        <div className="hidden h-8 w-px bg-gray-200 dark:bg-gray-800 sm:block" />
                        <div className="min-w-0">
                            <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100 md:text-base">
                                {currentSectionHeader.title}
                            </h1>
                            <p className="mt-0.5 hidden max-w-[260px] truncate text-xs font-medium text-gray-500 dark:text-gray-400 sm:block md:max-w-[420px]">
                                {currentSectionHeader.subtitle}
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                        <div className="flex items-center gap-2">
                            <select
                                value={provider}
                                onChange={(e) => {
                                    const nextProvider = e.target.value as typeof provider;
                                    setProvider(nextProvider);
                                    saveProvider(nextProvider);
                                }}
                                className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 text-xs font-bold text-gray-600 dark:text-gray-300 outline-none focus:ring-1 focus:ring-[#10A37F]"
                            >
                                {providerOptions.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select
                                value={selectedModel}
                                onChange={(e) => { setSelectedModel(e.target.value); saveModel(e.target.value); }}
                                disabled={!isOllama || !ollamaHasChatModels}
                                className="h-9 min-w-[170px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 text-xs font-bold text-gray-600 dark:text-gray-300 outline-none focus:ring-1 focus:ring-[#10A37F] disabled:opacity-60 hidden sm:block"
                            >
                                {provider === 'auto' ? (
                                    <option value="auto">[ Auto Provider Selection ]</option>
                                ) : isOllama ? (
                                    modelLoadError ? (
                                        <option value="disabled">Unable to load models</option>
                                    ) : ollamaHasChatModels ? (
                                        models.length > 0 ? (
                                            models.map(m => <option key={m} value={m}>{m}</option>)
                                        ) : (
                                            <option value="disabled">No chat models installed</option>
                                        )
                                    ) : (
                                        <option value="disabled">[ Ollama Offline ]</option>
                                    )
                                ) : (
                                    <option value="auto">[ Managed by Provider ]</option>
                                )}
                            </select>
                        </div>

                        <div className={cn("flex max-w-[320px] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", statusClasses)}>
                            {providerStatusInfo.connected || ollamaReachableNoModels ? (
                                <Wifi className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate">
                                {statusText}
                                {provider === 'auto' && providerStatusInfo.providerUsed ? ` (${providerStatusInfo.providerUsed.toUpperCase()})` : ''}
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
                                        anySuiteRunning={anySuiteRunning}
                                        executionLogs={executionLogs}
                                        executionSummary={executionSummary}
                                        passedTests={passedTests}
                                        failedTests={failedTests}
                                        headed={headed}
                                        onHeadedChange={setHeaded}
                                        reportUrl={reportUrl}
                                        automationRuns={automationRuns}
                                        automationToast={automationToast}
                                        onCloseToast={() => setAutomationToast(null)}
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
                                <ApiTestingWorkspace 
                                    globalProvider={provider}
                                    globalModel={selectedModel}
                                    onProviderChange={(p) => { setProvider(p); saveProvider(p); }}
                                    onModelChange={(m) => { setSelectedModel(m); saveModel(m); }}
                                />
                            )}

                            {activePanel === 'defect-studio' && (
                                <DefectStudio
                                    provider={provider}
                                    model={selectedModel}
                                    providerSettings={providerSettings}
                                />
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

                            {activePanel === 'memory-vault' && (
                                <MemoryVaultPanel
                                    onUseAsContext={handleUseMemoryAsContext}
                                    attachedContextId={attachedMemoryContext?.id}
                                />
                            )}

                            {activePanel === 'traceability' && (
                                <TraceabilityMatrixPanel />
                            )}

                            {activePanel === 'testcases' && (
                                <div className="flex flex-col min-h-full">
                                    {!currentThread?.prompt && conversationMessages.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50 dark:bg-gray-950/50">
                                            <div className="max-w-md w-full text-center space-y-6">
                                                <div className="w-16 h-16 bg-[#10A37F]/10 dark:bg-[#10A37F]/20 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-[#10A37F]/5">
                                                    <Bot className="w-8 h-8 text-[#10A37F]" />
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Start your first workspace</h3>
                                                    <p className="text-gray-500 dark:text-gray-400 text-sm">Enter a prompt below describing a feature, and I&apos;ll generate comprehensive test cases for you.</p>
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
                                            {conversationMessages.map((message) => (
                                                <div key={message.id} className="space-y-4">
                                                    <div className="flex gap-4 group">
                                                        <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0 shadow-sm border border-gray-300 dark:border-gray-700">
                                                            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">User</span>
                                                        </div>
                                                        <div className="flex-1 pt-1">
                                                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                                                {message.aiOptions?.jiraStoryId && (
                                                                    <span className="rounded-md bg-[#10A37F]/10 px-2 py-0.5 text-[11px] font-bold text-[#10A37F]">
                                                                        {message.aiOptions.jiraStoryId}
                                                                    </span>
                                                                )}
                                                                <span className="text-[11px] font-medium text-gray-400">
                                                                    {new Date(message.createdAt).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">{message.prompt || message.title}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-4">
                                                        <div className="w-8 h-8 rounded-lg bg-[#10A37F] flex items-center justify-center shrink-0 shadow-md shadow-[#10A37F]/20">
                                                            <Bot className="w-4 h-4 text-white" />
                                                        </div>
                                                        <div className="flex-1 pt-1 space-y-6">
                                                            {message.error ? (
                                                                <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-5 text-sm text-red-700 dark:text-red-300 shadow-sm">
                                                                    <div className="flex items-start gap-3">
                                                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="font-semibold">Generation failed</p>
                                                                            <p className="mt-1 text-red-600 dark:text-red-300">{message.error}</p>
                                                                            <button
                                                                                onClick={() => handleSend(message.prompt || currentThread?.prompt || "", message.aiOptions)}
                                                                                disabled={loading}
                                                                                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
                                                                            >
                                                                                <RefreshCw className="h-3.5 w-3.5" />
                                                                                Retry
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : message.result ? (
                                                                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden min-h-[400px]">
                                                                    <ChatMessage
                                                                        role="assistant"
                                                                        isTable
                                                                        tableData={message.result}
                                                                        qualityReport={message.qualityReport}
                                                                        jiraStoryId={message.aiOptions?.jiraStoryId || ''}
                                                                        platformType={message.platform || currentThread?.platform || "web"}
                                                                        onCopy={() => copyTestCaseData(message.result?.testCases)}
                                                                        onRegenerate={() => handleSend(message.prompt || currentThread?.prompt || "", message.aiOptions)}
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
                                                            ) : message.type === "automation_run" && message.automationRun ? (
                                                                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                        <div>
                                                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{message.title || "Automation Run"}</p>
                                                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                                                Status: {message.automationRun.status} - Passed: {message.automationRun.passed ?? 0} - Failed: {message.automationRun.failed ?? 0}
                                                                            </p>
                                                                        </div>
                                                                        <span className="rounded-full bg-[#10A37F]/10 px-2 py-1 text-xs font-bold text-[#10A37F]">
                                                                            {message.automationRun.suite || "generated"}
                                                                        </span>
                                                                    </div>
                                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                                        {[
                                                                            ["Playwright", message.automationRun.playwrightReportUrl],
                                                                            ["Allure", message.automationRun.allureReportUrl],
                                                                            ["Healing", message.automationRun.healingReportUrl],
                                                                            ["Logs", message.automationRun.logUrl],
                                                                        ].map(([label, url]) => url ? (
                                                                            <a key={label} href={String(url)} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                                                                                {label}
                                                                            </a>
                                                                        ) : null)}
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
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
                                    {attachedMemoryContext && (
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            <span className="inline-flex items-center gap-2 rounded-full border border-[#10A37F]/30 bg-white px-3 py-1 text-xs font-semibold text-[#10A37F] shadow-sm dark:bg-gray-900">
                                                Context attached: {attachedMemoryContext.title}
                                                <button onClick={handleClearMemoryContext} className="text-[#10A37F]/70 hover:text-red-500" title="Remove Memory Vault context">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
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
                                                    value={platformType}
                                                    onChange={(e) => setPlatformType(e.target.value as typeof platformType)}
                                                    className="h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 text-xs font-bold text-gray-600 dark:text-gray-300 outline-none focus:ring-1 focus:ring-[#10A37F]"
                                                >
                                                    {platformOptions.map(option => (
                                                        <option key={option} value={option}>{option.toUpperCase()}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleSend()}
                                                    disabled={loading || !value.trim() || (isOllama && !ollamaHasChatModels)}
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
