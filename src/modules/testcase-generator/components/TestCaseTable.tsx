"use client";

import { useState } from "react";
import { Copy, Download, RefreshCw, ThumbsUp, AlertCircle } from "lucide-react";
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
        return (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500 border border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                <AlertCircle className="w-8 h-8 mb-2 text-gray-300" />
                <p>No valid test cases found in response.</p>
            </div>
        );
    }

    return (
        <div className="w-full mt-2">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <button onClick={onCopy} className="flex items-center gap-2 text-xs bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors text-gray-700 shadow-sm font-medium">
                    <Copy className="w-3.5 h-3.5" /> Copy JSON
                </button>
                <button onClick={onDownload} className="flex items-center gap-2 text-xs bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors text-gray-700 shadow-sm font-medium">
                    <Download className="w-3.5 h-3.5" /> Export Excel
                </button>
                <div className="w-px h-5 bg-gray-200 mx-1"></div>
                <button title="Regenerate" onClick={onRegenerate} className="flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 w-8 h-8 rounded-md transition-colors text-gray-700 shadow-sm">
                    <RefreshCw className="w-4 h-4" />
                </button>
                <button title="Helpful" onClick={() => setLiked(!liked)} className={cn("flex items-center justify-center border border-gray-200 w-8 h-8 rounded-md transition-colors shadow-sm", liked ? "bg-green-50 text-green-600 border-green-200" : "bg-white hover:bg-gray-50 text-gray-700")}>
                    <ThumbsUp className={cn("w-4 h-4", liked ? "fill-green-600" : "")} />
                </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                <table className="w-full text-left text-sm text-gray-800 border-collapse">
                    <thead className="bg-[#fbfcff] text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                        <tr>
                            <th className="p-4 border-b border-gray-100">ID</th>
                            <th className="p-4 border-b border-gray-100 min-w-[200px]">Title</th>
                            <th className="p-4 border-b border-gray-100">Priority</th>
                            <th className="p-4 border-b border-gray-100 min-w-[250px]">Steps</th>
                            <th className="p-4 border-b border-gray-100 min-w-[200px]">Expected Result</th>
                            <th className="p-4 border-b border-gray-100">Test Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.testCases.map((tc, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-[#f8faff]/50 transition-colors align-top">
                                <td className="p-4 whitespace-nowrap text-gray-400 font-mono text-xs font-medium">{tc.testCaseId}</td>
                                <td className="p-4">
                                    <div className="font-semibold text-gray-800 mb-1">{tc.title}</div>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase">{tc.testType}</span>
                                </td>
                                <td className="p-4">
                                    <span className={cn(
                                        "text-[11px] px-2 py-1 rounded-full font-bold",
                                        tc.priority === "High" ? "bg-red-50 text-red-600" : 
                                        tc.priority === "Medium" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
                                    )}>
                                        {tc.priority}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600 leading-relaxed text-[13px] whitespace-pre-wrap">
                                    {tc.preconditions && tc.preconditions !== "None" && (
                                        <div className="mb-2 p-2 bg-gray-50 rounded text-xs border border-gray-100">
                                            <span className="font-bold text-gray-400 block mb-0.5 uppercase text-[9px]">Preconditions:</span>
                                            {tc.preconditions}
                                        </div>
                                    )}
                                    {tc.steps}
                                </td>
                                <td className="p-4 text-emerald-700 font-medium leading-relaxed text-[13px] whitespace-pre-wrap">{tc.expectedResult}</td>
                                <td className="p-4 text-gray-500 text-xs italic bg-gray-50/30">{tc.testData || "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
