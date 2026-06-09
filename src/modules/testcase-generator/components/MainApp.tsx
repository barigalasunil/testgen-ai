"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ClassicWorkspaceLayout } from "./layouts/ClassicWorkspaceLayout";
import { MaterialWorkspaceLayout } from "./layouts/MaterialWorkspaceLayout";
import { useTCGenWorkspace } from "../hooks/useTCGenWorkspace";
import { useTheme } from "../hooks/useTheme";
import { Layout, Monitor, Moon, Sun } from "lucide-react";

type UIMode = 'classic' | 'material';

export function MainApp() {
    const [uiMode, setUiMode] = useState<UIMode>('classic');
    const workspace = useTCGenWorkspace();
    const { theme, toggleTheme } = useTheme();

    // Load UI mode from localStorage on mount and handle migration
    useEffect(() => {
        let savedMode = localStorage.getItem("testgen-ui-mode");
        
        // Migration from gemini to material
        if (savedMode === 'gemini') {
            savedMode = 'material';
            localStorage.setItem("testgen-ui-mode", 'material');
        }

        if (savedMode && (savedMode === 'classic' || savedMode === 'material')) {
            setUiMode(savedMode as UIMode);
        }
    }, []);

    // Save UI mode to localStorage when it changes
    const toggleUiMode = (mode: UIMode) => {
        setUiMode(mode);
        localStorage.setItem("testgen-ui-mode", mode);
    };

    const uiModeToggle = (
        <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
                onClick={() => toggleUiMode('classic')}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-md transition-all",
                    uiMode === 'classic'
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
            >
                <Monitor className="w-3 h-3" />
                CLASSIC
            </button>
            <button
                onClick={() => toggleUiMode('material')}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-md transition-all",
                    uiMode === 'material'
                        ? "bg-white dark:bg-slate-700 text-[#1a73e8] dark:text-[#64b5f6] shadow-sm"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
            >
                <Layout className="w-3 h-3" />
                MATERIAL
            </button>
        </div>
    );

    const themeToggle = (
        <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
                onClick={() => toggleTheme('light')}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-md transition-all",
                    theme === 'light'
                        ? "bg-white text-amber-500 shadow-sm"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
            >
                <Sun className="w-3 h-3" />
                LIGHT
            </button>
            <button
                onClick={() => toggleTheme('dark')}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-md transition-all",
                    theme === 'dark'
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
            >
                <Moon className="w-3 h-3" />
                DARK
            </button>
        </div>
    );

    const controls = (
        <div className="flex items-center gap-2">
            {themeToggle}
            {uiModeToggle}
        </div>
    );

    if (uiMode === 'material') {
        return <MaterialWorkspaceLayout workspace={workspace} controls={controls} />;
    }

    return <ClassicWorkspaceLayout workspace={workspace} controls={controls} />;
}
