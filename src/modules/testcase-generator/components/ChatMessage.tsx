"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { TestCaseTable } from "./TestCaseTable";
import { TestCase } from "../types";

interface TestCaseResult {
    testCases: TestCase[];
}

function isTestCaseResult(data: unknown): data is TestCaseResult {
    return Boolean(data && typeof data === 'object' && Array.isArray((data as { testCases?: unknown }).testCases));
}

interface ChatMessageProps {
    role: "user" | "assistant";
    content?: string;
    isTable?: boolean;
    tableData?: { testCases: TestCase[] };
    jiraStoryId?: string;
    platformType?: "web" | "mobile" | "api" | "automation";
    onCopy?: () => void;
    onRegenerate?: () => void;
    onGenerateScript?: () => void;
    onRunAutomation?: () => void;
    onCopyScript?: () => void;
    onDownloadScript?: () => void;
    hasGeneratedScript?: boolean;
    isGeneratingScript?: boolean;
    isRunningAutomation?: boolean;
    onOpenJira?: (testCase: TestCase) => void;
    isLoading?: boolean;
}

export function ChatMessage({ 
    role, 
    content, 
    isTable, 
    tableData, 
    jiraStoryId,
    platformType,
    onCopy, 
    onRegenerate, 
    onGenerateScript,
    onRunAutomation,
    onCopyScript,
    onDownloadScript,
    hasGeneratedScript,
    isGeneratingScript,
    isRunningAutomation,
    isLoading,
    onOpenJira,
}: ChatMessageProps) {
    const isAssistant = role === "assistant";
    return (
        <div className={cn(
            "w-full py-6 text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 transition-colors duration-200", 
            isAssistant ? "bg-[#f7f7f8] dark:bg-[#1e1f20]/30" : "bg-white dark:bg-transparent"
        )}>
            <div className="max-w-4xl mx-auto flex gap-4 px-4 md:px-6">
                <div className="shrink-0 mt-1">
                    {isAssistant ? (
                        <div className="w-[30px] h-[30px] rounded-sm bg-[#10A37F] flex items-center justify-center shadow-sm">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                    ) : (
                        <div className="w-[30px] h-[30px] rounded-sm bg-blue-600 dark:bg-blue-700 flex items-center justify-center shadow-sm">
                            <User className="w-5 h-5 text-white" />
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-hidden min-w-0 flex flex-col justify-start min-h-[30px]">
                    {isLoading ? (
                        <div className="flex items-center gap-1.5 h-7">
                            <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700 animate-pulse" />
                            <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700 animate-pulse" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700 animate-pulse" style={{ animationDelay: "300ms" }} />
                        </div>
                    ) : isTable && tableData ? (
                        isTestCaseResult(tableData) ? (
                            <TestCaseTable 
                                data={tableData} 
                                jiraStoryId={jiraStoryId}
                                platformType={platformType}
                                onCopy={onCopy || (() => {})} 
                                onRegenerate={onRegenerate || (() => {})}
                                onGenerateScript={onGenerateScript}
                                onRunAutomation={onRunAutomation}
                                onCopyScript={onCopyScript}
                                onDownloadScript={onDownloadScript}
                                hasGeneratedScript={hasGeneratedScript}
                                isGeneratingScript={isGeneratingScript}
                                isRunningAutomation={isRunningAutomation}
                                onOpenJira={onOpenJira}
                            />
                        ) : (
                            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-900/30 p-4 text-sm text-yellow-800 dark:text-yellow-400">
                                <div className="font-semibold">Unexpected response format</div>
                                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-400">{JSON.stringify(tableData, null, 2)}</pre>
                            </div>
                        )
                    ) : (
                        <div className="whitespace-pre-wrap leading-7 text-[15px]">{content}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
