"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2, Bot } from "lucide-react";

export function AI_Prompt() {
    const [value, setValue] = useState("");
    const [response, setResponse] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!value.trim()) return;

        console.log("SEND CLICKED");
        console.log("CALLING API...");

        setLoading(true);
        setResponse("");

        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: value, model: "phi3:mini" }),
            });

            const data = await res.json();
            console.log("RESPONSE RECEIVED:", data);
            if (data.result) {
                console.log("AI Response:", data.result);
            }
            setResponse(data.result);
        } catch (error) {
            console.error("FETCH ERROR:", error);
            setResponse("Error: " + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative group rounded-3xl bg-card border border-border overflow-hidden shadow-2xl hover:shadow-primary/20 transition-all duration-500 hover:-translate-y-1"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl" />

                <div className="relative flex flex-col p-3">
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Describe the feature or provide requirements to generate robust test cases..."
                        className="w-full min-h-[140px] p-5 bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground/60 focus:ring-0 leading-relaxed text-lg"
                    />

                    <div className="flex justify-between items-center px-3 pb-2 pt-4 border-t border-border/30">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                            <span className="hidden sm:inline">Powered by local AI</span>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSend}
                            disabled={loading || !value.trim()}
                            className="bg-primary text-primary-foreground p-3.5 rounded-2xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(229,57,53,0.3)] hover:shadow-[0_0_25px_rgba(229,57,53,0.6)] transition-shadow duration-300 relative overflow-hidden"
                        >
                            {loading && (
                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                            )}
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin relative z-10" />
                            ) : (
                                <Send className="w-6 h-6 relative z-10 translate-x-[2px]" />
                            )}
                        </motion.button>
                    </div>
                </div>
            </motion.div>

            <AnimatePresence>
                {response && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, y: -20 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -20 }}
                        transition={{ duration: 0.5, type: "spring", bounce: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl relative mt-4 group">
                            <div className="absolute -top-4 -left-4 bg-gradient-to-br from-primary to-accent text-white p-3 rounded-2xl shadow-xl rotate-12 group-hover:rotate-0 transition-transform duration-300">
                                <Bot className="w-7 h-7" />
                            </div>
                            <div className="pl-6 pt-2">
                                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
                                    Generated Test Cases
                                    <div className="h-[1px] flex-grow bg-gradient-to-r from-border to-transparent ml-4"></div>
                                </h3>
                                <pre className="whitespace-pre-wrap font-sans bg-muted/30 p-6 rounded-2xl border border-border/40 text-base leading-relaxed text-card-foreground shadow-inner">
                                    {response}
                                </pre>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}