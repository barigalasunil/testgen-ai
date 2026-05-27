"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, ChevronDown, Settings as SettingsIcon, Tag, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveModel, saveProvider } from "@/src/services/ai/ai-config.service";

const AUTO_MODEL = "auto";
const AUTO_MODEL_LABEL = "Auto (Recommended)";

interface StoryData {
    summary: string;
    description: string;
    storyId: string;
}

interface InputBoxProps {
    value: string;
    onChange: (val: string) => void;
    onSend: () => void;
    disabled: boolean;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    models: string[];
    selectedModel: string;
    onModelChange?: (model: string) => void;
    isJiraMode: boolean;
    setIsJiraMode: (mode: boolean) => void;
    platformType: "web" | "mobile" | "api";
    setPlatformType: (type: "web" | "mobile" | "api") => void;
    customPrompt: string;
    setCustomPrompt: (val: string) => void;
    acceptanceCriteria: string;
    setAcceptanceCriteria: (val: string) => void;
    jiraStoryId: string;
    setJiraStoryId: (val: string) => void;
    onStoryLoaded?: (story: StoryData) => void;
}

export function InputBox({
    value,
    onChange,
    onSend,
    disabled,
    inputRef,
    models,
    selectedModel,
    platformType,
    setPlatformType,
    customPrompt,
    setCustomPrompt,
    acceptanceCriteria,
    setAcceptanceCriteria,
    jiraStoryId,
    setJiraStoryId,
    onStoryLoaded,
}: InputBoxProps) {
    const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Jira story fetch states
    const [storyFetching, setStoryFetching] = useState(false);
    const [storyLoaded, setStoryLoaded] = useState(false);
    const [storyError, setStoryError] = useState('');
    const [storyTitle, setStoryTitle] = useState('');

    const advRef = useRef<HTMLDivElement | null>(null);
    const toggleRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!showAdvanced) return;
        function handleDown(e: MouseEvent) {
            const target = e.target as Node;
            if (advRef.current?.contains(target)) return;
            if (toggleRef.current?.contains(target)) return;
            setShowAdvanced(false);
        }
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setShowAdvanced(false);
        }
        document.addEventListener('mousedown', handleDown);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleDown);
            document.removeEventListener('keydown', handleKey);
        };
    }, [showAdvanced]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        if (inputRef.current) {
            inputRef.current.style.height = "24px";
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
        }
    };

    const handleFetchStory = async () => {
        if (!jiraStoryId.trim()) return;
        setStoryFetching(true);
        setStoryError('');
        setStoryLoaded(false);
        setStoryTitle('');

        try {
            const { fetchJiraStory } = await import('@/src/services/jira/jira.service');
            const res = await fetchJiraStory(jiraStoryId.trim());

            if (res.success) {
                setStoryLoaded(true);
                setStoryTitle(res.summary || '');
                // Persist full story metadata to localStorage for RAG context
                const ragKey = 'tcgen-rag-stories';
                const existing: any[] = JSON.parse(localStorage.getItem(ragKey) || '[]');
                const newEntry = {
                    storyId: jiraStoryId.trim(),
                    summary: res.summary || '',
                    description: res.description || '',
                    issueType: res.issueType || '',
                    priority: res.priority || '',
                    status: res.status || '',
                    issueUrl: res.issueUrl || '',
                    fetchedAt: new Date().toISOString(),
                };
                const updated = [newEntry, ...existing.filter((e: any) => e.storyId !== jiraStoryId.trim())].slice(0, 20);
                localStorage.setItem(ragKey, JSON.stringify(updated));
                // Fire callback to auto-fill the prompt in MainApp
                onStoryLoaded?.({
                    summary: res.summary || '',
                    description: res.description || '',
                    storyId: jiraStoryId.trim(),
                });
                // Auto-ingest into RAG for future generation context
                try {
                    const creds = JSON.parse(localStorage.getItem('jira-credentials') || '{}');
                    fetch('/api/rag/ingest', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: res.summary || '',
                            description: res.description || '',
                            acceptanceCriteria: '',
                            projectKey: creds.projectKey || (jiraStoryId.trim().split('-')[0] || 'TCGB'),
                            jiraStoryId: jiraStoryId.trim(),
                        }),
                    }).catch(() => {});
                } catch {}
            } else {
                setStoryError(res.error || 'Failed to load story');
            }
        } catch {
            setStoryError('Could not reach Jira. Check your credentials in settings.');
        } finally {
            setStoryFetching(false);
        }
    };

    const modelOptions = [AUTO_MODEL, ...(models || [])];
    const selectedModelLabel = selectedModel === AUTO_MODEL ? AUTO_MODEL_LABEL : selectedModel || "Select model";

    const storyBorderColor = storyFetching
        ? "border-blue-300"
        : storyLoaded
            ? "border-emerald-400"
            : storyError
                ? "border-red-300"
                : "border-gray-200";

    return (
        <div className="w-full">
            <div className="max-w-5xl mx-auto w-full flex flex-col gap-3">

                {/* Advanced Options Panel */}
                <AnimatePresence>
                    {showAdvanced && (
                        <motion.div
                            ref={advRef}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="flex flex-col gap-3 mb-2 bg-gray-50/50 p-3 rounded-xl border border-gray-100"
                        >
                            <h3 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                                Advanced Configuration
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-gray-500 ml-1">
                                        Acceptance Criteria
                                    </label>
                                    <textarea
                                        placeholder="Paste Jira AC or specific requirements..."
                                        value={acceptanceCriteria}
                                        onChange={(e) => setAcceptanceCriteria(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none h-20 shadow-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-gray-500 ml-1">
                                        Custom Prompt Instructions
                                    </label>
                                    <textarea
                                        placeholder="Add specific instructions for the AI..."
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none h-20 shadow-sm"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Jira story loaded banner */}
                <AnimatePresence>
                    {storyLoaded && storyTitle && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                                <span className="font-bold">{jiraStoryId}</span>
                                {' '}loaded — prompt auto-filled with story content.
                                {' '}<span className="text-emerald-600 italic truncate">{storyTitle.slice(0, 60)}</span>
                            </span>
                            <button
                                onClick={() => { setStoryLoaded(false); setStoryTitle(''); }}
                                className="ml-auto text-emerald-500 hover:text-emerald-700 font-bold"
                            >
                                ×
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Jira story error banner */}
                <AnimatePresence>
                    {storyError && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700"
                        >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{storyError}</span>
                            <button
                                onClick={() => setStoryError('')}
                                className="ml-auto text-red-400 hover:text-red-700 font-bold"
                            >
                                ×
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Toolbar */}
                <div className="flex justify-between items-center px-1 mb-1 flex-wrap gap-2">
                    <div className="flex gap-2 items-center flex-wrap">

                        {/* Platform Selector removed model selector from here */}

                        {/* Platform Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setIsPlatformDropdownOpen(!isPlatformDropdownOpen)}
                                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm transition-colors font-medium"
                            >
                                <SettingsIcon className="w-3.5 h-3.5 text-blue-500" />
                                {platformType.charAt(0).toUpperCase() + platformType.slice(1)}
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <AnimatePresence>
                                {isPlatformDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[120px] z-50"
                                    >
                                        {(["web", "mobile", "api"] as const).map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => { setPlatformType(p); setIsPlatformDropdownOpen(false); }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                                                    p === platformType
                                                        ? "bg-blue-500 text-white"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                )}
                                            >
                                                {p.charAt(0).toUpperCase() + p.slice(1)}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Jira Story ID — fetch on Enter or Load button */}
                        <div className={cn(
                            "flex items-center gap-1.5 bg-white border rounded-full px-3 py-1.5 shadow-sm transition-all",
                            storyBorderColor
                        )}>
                            <Tag className={cn(
                                "w-3.5 h-3.5 shrink-0",
                                storyLoaded ? "text-emerald-500" : storyError ? "text-red-400" : "text-blue-500"
                            )} />
                            <input
                                type="text"
                                placeholder="Story ID e.g. TCGB-10"
                                value={jiraStoryId}
                                onChange={(e) => {
                                    setJiraStoryId(e.target.value);
                                    setStoryLoaded(false);
                                    setStoryError('');
                                    setStoryTitle('');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleFetchStory();
                                    }
                                }}
                                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder:text-gray-400 font-mono w-28"
                            />
                            {/* Load button — shows when ID entered and not yet loaded */}
                            {jiraStoryId.trim() && !storyLoaded && !storyFetching && (
                                <button
                                    onClick={handleFetchStory}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 whitespace-nowrap px-1"
                                >
                                    Load ↵
                                </button>
                            )}
                            {/* Spinner while fetching */}
                            {storyFetching && (
                                <span className="h-3 w-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                            )}
                            {/* Success tick */}
                            {storyLoaded && !storyFetching && (
                                <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                            )}
                        </div>

                        {/* Advanced Toggle */}
                        <button
                            ref={toggleRef}
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            aria-expanded={showAdvanced}
                            className={cn(
                                "flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-full border transition-all font-bold tracking-wide uppercase",
                                showAdvanced
                                    ? "bg-blue-600 border-blue-600 text-white shadow-md"
                                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm"
                            )}
                        >
                            {showAdvanced ? "Hide" : "Advanced"}
                        </button>
                    </div>
                </div>

                {/* Text input */}
                <div className="relative flex items-end w-full bg-white rounded-xl border border-gray-300 shadow-[0_0_15px_rgba(0,0,0,0.05)] focus-within:shadow-[0_0_15px_rgba(0,0,0,0.1)] transition-shadow">
                    <textarea
                        ref={inputRef}
                        value={value}
                        onChange={handleInput}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                onSend();
                            }
                        }}
                        placeholder="Describe the feature to generate test cases... or load a Jira story above"
                        className="w-full bg-transparent text-gray-800 placeholder-gray-400 m-0 border-0 outline-none resize-none py-3.5 pl-4 pr-12 text-[15px] max-h-[200px]"
                        rows={1}
                        style={{ height: "52px" }}
                    />
                    <button
                        onClick={onSend}
                        disabled={disabled || !value.trim()}
                        className="absolute right-3 bottom-2.5 p-1.5 rounded-md text-white bg-[#10A37F] hover:bg-[#1A7F66] transition-colors disabled:bg-gray-200 disabled:text-gray-400"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>

                <div className="text-center text-[10px] text-gray-400 mt-1 font-sans uppercase tracking-widest">
                    TCGen-Buddy • Platform Aware • AI Verified
                </div>
            </div>
        </div>
    );
}
