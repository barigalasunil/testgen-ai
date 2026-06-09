"use client";

import { useState, useEffect } from "react";

export type ThemeMode = 'light' | 'dark';

export function useTheme() {
    const [theme, setTheme] = useState<ThemeMode>('light');

    useEffect(() => {
        const savedTheme = localStorage.getItem("testgen-theme") as ThemeMode;
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
            setTheme(savedTheme);
            if (savedTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, []);

    const toggleTheme = (newTheme: ThemeMode) => {
        setTheme(newTheme);
        localStorage.setItem("testgen-theme", newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    return { theme, toggleTheme };
}
