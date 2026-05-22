"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { TestCaseTable } from "./TestCaseTable";
import { TestCase } from "../types";

interface ChatMessageProps {
    role: "user" | "assistant";
    content?: string;
    isTable?: boolean;
    tableData?: { testCases: TestCase[] };
    onCopy?: () => void;
    onDownload?: () => void;
    onRegenerate?: () => void;
    isLoading?: boolean;
}

export function ChatMessage({ 
    role, 
    content, 
    isTable, 
    tableData, 
    onCopy, 
    onDownload, 
    onRegenerate, 
    isLoading 
}: ChatMessageProps) {
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
                    ) : isTable && tableData ? (
                        <TestCaseTable 
                            data={tableData} 
                            onCopy={onCopy || (() => {})} 
                            onDownload={onDownload || (() => {})} 
                            onRegenerate={onRegenerate || (() => {})} 
                        />
                    ) : (
                        <div className="whitespace-pre-wrap leading-7 text-[15px]">{content}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
