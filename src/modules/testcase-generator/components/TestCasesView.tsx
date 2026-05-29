"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { InputBox } from "./InputBox";
import { HistoryItem, TestCase, AiGenerationOptions } from "../types";

type TestCasesViewProps = {
    currentThread: HistoryItem | null;
    value: string;
    setValue: (v: string) => void;
    onSend: (overridePrompt?: string, overrideOptions?: Partial<AiGenerationOptions>) => void;
    loading: boolean;
    resultTab: 'testCases' | 'scripts' | 'logs';
    setResultTab: (tab: 'testCases' | 'scripts' | 'logs') => void;
    platformType: "web" | "mobile" | "api";
    setPlatformType: (t: "web" | "mobile" | "api") => void;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    progressLabel: string;
    generationModelStatus: string;
    generatingPrompt: string;
    onCopyTableData: () => void;
    onOpenJira: (testCase: TestCase) => void;
};

export function TestCasesView({
    currentThread,
    value,
    setValue,
    onSend,
    loading,
    resultTab,
    setResultTab,
    platformType,
    setPlatformType,
    textareaRef,
    messagesEndRef,
    progressLabel,
    generationModelStatus,
    generatingPrompt,
    onCopyTableData,
    onOpenJira,
}: TestCasesViewProps) {
    return (
        <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
            <section className="flex-1 min-h-0 overflow-y-auto px-4 py-4 lg:px-6">
                <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-6">
                    {currentThread?.prompt ? (
                        <ChatMessage role="user" content={currentThread.prompt} />
                    ) : (
                        <div className="min-h-[220px] flex items-center justify-center text-slate-400 text-sm">
                            Describe a feature to generate test cases...
                        </div>
                    )}

                    {currentThread && (currentThread.result || currentThread.error) && (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                    <span className="font-medium capitalize text-slate-700">{currentThread.platform}</span>
                                    <span className={cn('rounded-full px-2.5 py-1 font-medium',
                                        currentThread.error ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                    )}>
                                        {currentThread.error ? 'Error' : 'Ready'}
                                    </span>
                                    {currentThread.aiMeta?.message && (
                                        <span className={cn(
                                            'rounded-full border px-2.5 py-1 font-medium',
                                            currentThread.aiMeta.fallbackUsed
                                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                : 'border-slate-200 bg-white text-slate-600'
                                        )}>
                                            {currentThread.aiMeta.message}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(['testCases', 'scripts', 'logs'] as const).map((tab) => (
                                        <button key={tab} onClick={() => setResultTab(tab)}
                                            className={cn('rounded-full px-3 py-1.5 text-xs font-semibold transition',
                                                resultTab === tab ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                            )}>
                                            {tab === 'testCases' ? 'Test Cases' : tab === 'scripts' ? 'Scripts' : 'Logs'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {resultTab === 'testCases' && currentThread.result && (
                                <ChatMessage
                                    role="assistant"
                                    isTable
                                    tableData={currentThread.result}
                                    jiraStoryId={currentThread.aiOptions?.jiraStoryId || ''}
                                    platformType={currentThread.platform}
                                    onCopy={onCopyTableData}
                                    onRegenerate={() => onSend(currentThread.prompt, currentThread.aiOptions)}
                                    onOpenJira={onOpenJira}
                                />
                            )}

                            {resultTab === 'scripts' && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                                    <p className="text-slate-500 text-xs">Generate scripts from the Test Cases tab.</p>
                                </div>
                            )}

                            {resultTab === 'logs' && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                                    {currentThread.error ? (
                                        <div className="space-y-3">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-sm text-slate-600">Generation failed. Retry uses the same prompt, model mode, platform, Jira ID, and advanced options.</p>
                                                <button
                                                    type="button"
                                                    onClick={() => currentThread.prompt && onSend(currentThread.prompt, currentThread.aiOptions)}
                                                    disabled={loading || !currentThread.prompt}
                                                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Retry Generation
                                                </button>
                                            </div>
                                            <pre className="whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200 overflow-auto max-h-96">{currentThread.error}</pre>
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-sm">No errors were captured.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </section>

            {/* Input bar */}
            <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-slate-50/95 backdrop-blur-sm px-4 py-4 shadow-inner">
                {loading && (
                    <div className="mx-auto mb-3 flex max-w-5xl items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                        <div className="flex items-center gap-1.5">
                            {[0, 150, 300].map(d => (
                                <span key={d} className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: `${d}ms` }} />
                            ))}
                        </div>
                        <span className="font-medium">{progressLabel}</span>
                        <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 sm:inline-flex">
                            {generationModelStatus}
                        </span>
                        {generatingPrompt && (
                            <span className="ml-auto hidden max-w-[40%] truncate text-xs text-slate-400 sm:block">{generatingPrompt}</span>
                        )}
                    </div>
                )}
                <InputBox
                    value={value}
                    onChange={setValue}
                    onSend={onSend}
                    disabled={loading}
                    inputRef={textareaRef}
                    platformType={platformType}
                    setPlatformType={setPlatformType}
                />
            </div>
        </div>
    );
}
```

Wait, I need to re-read the file to get the exact content properly. Let me be more careful with the TestCasesView - I should extract only the main content area.

Actually, looking at the MainApp.tsx, I can see the main content area (chat + input). Let me fix the TestCasesView to be more complete. Let me also check what the InputBox props look like.

Looking at MainApp, I see:
- `resultTab` state
- `platformType` state
- `textareaRef`
- `messagesEndRef`
- `progressLabel` 
- `generationModelStatus`
- `generatingPrompt`
- `currentThread`

The TestCasesView needs these. Also I need to check the InputBox interface.
```tool
TOOL_NAME: read_file
BEGIN_ARG: filepath
src/modules/testcase-generator/components/InputBox.tsx