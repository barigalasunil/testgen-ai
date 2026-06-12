"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

type ProgressState = {
  active: boolean;
  message?: string;
  progress?: number; // 0 to 100
};

type ProgressContextType = {
  startProgress: (message?: string) => void;
  updateProgress: (progress: number, message?: string) => void;
  stopProgress: () => void;
};

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>({ active: false });

  const startProgress = (message?: string) => setState({ active: true, message, progress: 0 });
  const updateProgress = (progress: number, message?: string) => setState(prev => ({ ...prev, progress, message: message || prev.message }));
  const stopProgress = () => setState({ active: false });

  return (
    <ProgressContext.Provider value={{ startProgress, updateProgress, stopProgress }}>
      {children}
      {state.active && (
        <div className="fixed top-0 left-0 right-0 z-[9999]">
          <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div 
              className="h-full bg-[#10A37F] transition-all duration-300 ease-out shadow-[0_0_10px_#10A37F]"
              style={{ width: `${state.progress ?? 0}%` }}
            />
          </div>
          {state.message && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-gray-200 bg-white/80 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#10A37F] shadow-xl backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80">
              {state.message}
            </div>
          )}
        </div>
      )}
    </ProgressContext.Provider>
  );
}

export function useGlobalProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useGlobalProgress must be used within a ProgressProvider');
  return context;
}
