"use client";

import { useState } from "react";
import { Copy, Download, RefreshCw, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { TestCase } from "../types";

interface TestCaseTableProps {
    data: { testCases: TestCase[] };
    onCopy: () => void;
    onDownload: () => void;
    onRegenerate: () => void;
}

export function TestCaseTable({ data, onCopy, onDownload, onRegenerate }: TestCaseTableProps) {
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
                        {data.testCases.map((tc, i) => (
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
