"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, ChevronDown, Link as LinkIcon, Settings as SettingsIcon, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputBoxProps {
    value: string;
    onChange: (val: string) => void;
    onSend: () => void;
    disabled: boolean;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    models: string[];
    selectedModel: string;
    setSelectedModel: (model: string) => void;
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
}

export function InputBox({ 
    value, 
    onChange, 
    onSend, 
    disabled, 
    inputRef, 
    models, 
    selectedModel, 
    setSelectedModel, 
    isJiraMode, 
    setIsJiraMode,
    platformType,
    setPlatformType,
    customPrompt,
    setCustomPrompt,
    acceptanceCriteria,
    setAcceptanceCriteria,
    jiraStoryId,
    setJiraStoryId
}: InputBoxProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        if (inputRef.current) {
            inputRef.current.style.height = "24px";
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
        }
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6 z-10 w-full">
            <div className="max-w-4xl mx-auto px-4 md:px-6 w-full flex flex-col gap-2">
                
                {/* Advanced Options */}
                <AnimatePresence>
                    {showAdvanced && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-col gap-3 mb-2 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                            <h3 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Configuration</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-gray-500 ml-1">Acceptance Criteria</label>
                                    <textarea 
                                        placeholder="Paste Jira AC or specific requirements..." 
                                        value={acceptanceCriteria} 
                                        onChange={(e) => setAcceptanceCriteria(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none h-20 shadow-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-gray-500 ml-1">Custom Prompt Instructions</label>
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

                {/* Toolbar */}
                <div className="flex justify-between items-center px-1 mb-1">
                   <div className="flex gap-2 items-center flex-wrap">
                       {/* Model Selector */}
                       <div className="relative">
                           <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm transition-colors font-medium">
                               <Bot className="w-4 h-4 text-[#10A37F]" />
                               {selectedModel || "Detecting..."}
                               <ChevronDown className="w-3.5 h-3.5" />
                           </button>
                           <AnimatePresence>
                               {isDropdownOpen && (
                                   <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[160px] z-50">
                                       {models?.map((m: string) => (
                                           <button key={m} onClick={() => { setSelectedModel(m); setIsDropdownOpen(false); }} className={cn("w-full text-left px-3 py-2 text-sm rounded-md transition-colors", m === selectedModel ? "bg-[#10A37F] text-white" : "text-gray-700 hover:bg-gray-100")}>
                                               {m}
                                           </button>
                                       ))}
                                       {(!models || models.length === 0) && (
                                           <div className="px-3 py-2 text-sm text-gray-400">Loading API...</div>
                                       )}
                                   </motion.div>
                               )}
                           </AnimatePresence>
                       </div>

                       {/* Platform Selector */}
                       <div className="relative">
                          <button onClick={() => setIsPlatformDropdownOpen(!isPlatformDropdownOpen)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm transition-colors font-medium">
                              <SettingsIcon className="w-3.5 h-3.5 text-blue-500" />
                              {platformType ? platformType.charAt(0).toUpperCase() + platformType.slice(1) : "Platform"}
                              <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <AnimatePresence>
                              {isPlatformDropdownOpen && (
                                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[120px] z-50">
                                      {(["web", "mobile", "api"] as const).map((p) => (
                                          <button key={p} onClick={() => { setPlatformType(p); setIsPlatformDropdownOpen(false); }} className={cn("w-full text-left px-3 py-2 text-sm rounded-md transition-colors", p === platformType ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-gray-100")}>
                                              {p.charAt(0).toUpperCase() + p.slice(1)}
                                          </button>
                                      ))}
                                  </motion.div>
                              )}
                          </AnimatePresence>
                      </div>

                      {/* Jira Story ID */}
                      <div className="flex items-center min-w-[180px] bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm">
                          <Tag className="w-3.5 h-3.5 text-blue-500" />
                          <input
                              type="text"
                              placeholder="Jira Story ID"
                              value={jiraStoryId}
                              onChange={(e) => setJiraStoryId(e.target.value)}
                              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder:text-gray-400 font-mono"
                          />
                      </div>

                      {/* Advanced Toggle */}
                      <button 
                        onClick={() => setShowAdvanced(!showAdvanced)} 
                        className={cn(
                            "flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-full border transition-all font-bold tracking-wide uppercase",
                            showAdvanced ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm"
                        )}
                    >
                        {showAdvanced ? "Hide Options" : "Advanced"}
                    </button>

                    {/* Jira Story ID badge (inline preview when set & panel hidden) */}
                    {jiraStoryId.trim() && !showAdvanced && (
                        <span className="flex items-center gap-1.5 text-[11px] bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-full font-bold">
                            <Tag className="w-3 h-3" />
                            {jiraStoryId.trim()}
                        </span>
                    )}
                   </div>

                   {/* Jira Toggle */}
                   <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
                       <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                       <span className="text-sm font-medium text-gray-600">Jira Link</span>
                       <button onClick={() => setIsJiraMode(!isJiraMode)} className={cn("w-8 h-4 rounded-full transition-colors relative flex items-center", isJiraMode ? "bg-blue-500" : "bg-gray-200")}>
                           <motion.div layout animate={{ x: isJiraMode ? 16 : 2 }} className="w-3 h-3 bg-white rounded-full shadow-sm" />
                       </button>
                   </div>
                </div>

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
                        placeholder={isJiraMode ? "Paste Jira Ticket URL..." : "Describe the feature to generate test cases..."}
                        className="w-full bg-transparent text-gray-800 placeholder-gray-400 m-0 border-0 outline-none resize-none py-3.5 pl-4 pr-12 text-[15px] max-h-[200px]"
                        rows={1}
                        style={{ height: "52px" }}
                    />
                    <button
                        onClick={onSend}
                        disabled={disabled || !value.trim()}
                        className="absolute right-3 bottom-2.5 p-1.5 rounded-md text-white bg-[#10A37F] hover:bg-[#1A7F66] transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-100"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-center text-[10px] text-gray-400 mt-2 font-sans uppercase tracking-widest">
                    TCGen-Buddy • Platform Aware • AI Verified
                </div>
            </div>
        </div>
    );
}
