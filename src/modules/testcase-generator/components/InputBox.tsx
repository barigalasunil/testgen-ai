"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ChevronDown, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputBoxProps {
    value: string;
    onChange: (val: string) => void;
    onSend: () => void;
    disabled: boolean;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    platformType: "web" | "mobile" | "api";
    setPlatformType: (type: "web" | "mobile" | "api") => void;
}

export function InputBox({
    value,
    onChange,
    onSend,
    disabled,
    inputRef,
    platformType,
    setPlatformType,
}: InputBoxProps) {
    const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        if (inputRef.current) {
            inputRef.current.style.height = "24px";
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
        }
    };

    return (
        <div className="w-full">
            <div className="max-w-5xl mx-auto w-full flex flex-col gap-3">

                {/* Toolbar */}
                <div className="flex justify-between items-center px-1 mb-1 flex-wrap gap-2">
                    <div className="flex gap-2 items-center flex-wrap">

                        {/* Platform Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setIsPlatformDropdownOpen(!isPlatformDropdownOpen)}
                                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full shadow-sm transition-colors font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:bg-gray-50"
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
                        placeholder="Describe a feature to generate test cases..."
                        className="w-full bg-transparent text-gray-800 placeholder-gray-400 m-0 border-0 outline-none resize-none py-3.5 pl-4 pr-12 text-[15px] max-h-[200px]"
                        rows={1}
                        style={{ height: "52px" }}
                    />
                    <button
                        onClick={onSend}
                        disabled={disabled || !value.trim()}
                        className="absolute right-3 bottom-2.5 p-1.5 rounded-md text-white transition-colors bg-[#10A37F] hover:bg-[#1A7F66] disabled:bg-gray-200 disabled:text-gray-400"
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
