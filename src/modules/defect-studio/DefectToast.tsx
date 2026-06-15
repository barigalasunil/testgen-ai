"use client";

import { CheckCircle2, Copy, ExternalLink, X, XCircle } from "lucide-react";

export type DefectToastState = {
    type: "success" | "error";
    message: string;
    issueKey?: string;
    issueUrl?: string;
};

type DefectToastProps = {
    toast: DefectToastState | null;
    onClose: () => void;
};

export function DefectToast({ toast, onClose }: DefectToastProps) {
    if (!toast) return null;

    const copyLink = async () => {
        if (!toast.issueUrl) return;
        await navigator.clipboard.writeText(toast.issueUrl);
    };

    return (
        <div className="fixed bottom-5 right-5 z-[70] w-[min(420px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
                <div className={toast.type === "success" ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}>
                    {toast.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{toast.message}</p>
                    {toast.issueKey ? <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{toast.issueKey}</p> : null}
                    {toast.issueUrl ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <a href={toast.issueUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#10A37F] px-3 text-xs font-bold text-white hover:bg-[#0d8c6d]">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open Jira
                            </a>
                            <button onClick={copyLink} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                                <Copy className="h-3.5 w-3.5" />
                                Copy Link
                            </button>
                        </div>
                    ) : null}
                </div>
                <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close toast">
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
