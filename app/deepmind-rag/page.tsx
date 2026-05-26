"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
    Brain, Search, Filter, Upload, Database, 
    RefreshCcw, FileText, CheckCircle2, AlertCircle,
    ChevronRight, ExternalLink, HardDrive, Cpu, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

type RagItem = {
    id: string;
    type: 'story' | 'prd' | 'api' | 'manual' | 'defect';
    title: string;
    projectKey: string;
    source: string;
    status: 'indexed' | 'processing' | 'failed';
    timestamp: string;
    chunks: number;
};

const PROJECT_KEYS = ['TCGB', 'TCA', 'AUTH', 'PAY'];

export default function DeepMindRagPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedProject, setSelectedProject] = useState("All");
    const [isUploading, setIsUploading] = useState(false);
    const [items, setItems] = useState<RagItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchItems = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/rag/list?projectKey=${selectedProject}`);
            const data = await res.json();
            if (data.success) {
                setItems(data.items.map((it: any) => ({
                    id: it.id.toString(),
                    type: it.type,
                    title: it.title,
                    projectKey: it.project_key,
                    source: it.source,
                    status: 'indexed',
                    timestamp: new Date(it.created_at).toLocaleString(),
                    chunks: it.type === 'requirement' ? 12 : 5 // Mock chunks for now
                })));
            }
        } catch (e) {
            console.error("Failed to fetch RAG items", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [selectedProject]);

    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             item.projectKey.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesProject = selectedProject === "All" || item.projectKey === selectedProject;
        return matchesSearch && matchesProject;
    });

    const stats = {
        totalItems: items.length,
        totalChunks: items.reduce((acc, curr) => acc + curr.chunks, 0),
        projects: PROJECT_KEYS.length,
        lastSync: '12 mins ago'
    };

    return (
        <div className="min-h-screen bg-[#0a0c10] text-slate-200 font-sans selection:bg-emerald-500/30">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
                <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-500/5 blur-[120px] rounded-full" />
            </div>

            {/* Header */}
            <header className="relative border-b border-emerald-500/10 bg-black/40 backdrop-blur-xl px-8 py-6 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                        <Brain className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">DeepMind RAG</h1>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 tracking-tighter uppercase">Enterprise</span>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Centralized AI Semantic Memory & Knowledge Ingestion</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-6 px-6 py-2 rounded-2xl bg-white/5 border border-white/5">
                        <div className="text-center">
                            <p className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-0.5">Vector Nodes</p>
                            <p className="text-lg font-mono text-emerald-400 font-bold">{stats.totalChunks}</p>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                            <p className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-0.5">Projects</p>
                            <p className="text-lg font-mono text-blue-400 font-bold">{stats.projects}</p>
                        </div>
                    </div>
                    <Link href="/" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition flex items-center gap-2">
                        Dashboard <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </header>

            <main className="relative max-w-7xl mx-auto px-8 py-10 z-10">
                {/* Search & Actions */}
                <div className="flex flex-col md:flex-row gap-4 mb-10 items-center justify-between">
                    <div className="relative flex-1 w-full max-w-xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search indexed stories, PRDs, or project memory..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition shadow-inner"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                            {['All', ...PROJECT_KEYS].map(p => (
                                <button 
                                    key={p} 
                                    onClick={() => setSelectedProject(p)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                                        selectedProject === p ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                        <button className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all">
                            <Upload className="w-4 h-4" /> Ingest Knowledge
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Column: Stats & Resources */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Memory Health
                            </h3>
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="text-slate-400">Embedding Success</span>
                                        <span className="text-emerald-400 font-bold">98.2%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '98.2%' }} />
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="text-slate-400">Project Isolation</span>
                                        <span className="text-blue-400 font-bold">Active</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Project contexts are strictly isolated via vector namespaces.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-slate-400" /> Infrastructure
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Vector DB</span>
                                    <span className="font-mono text-slate-300">ChromaDB</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Embedding Node</span>
                                    <span className="font-mono text-slate-300">Local (Ollama)</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Retrieval Mode</span>
                                    <span className="font-mono text-slate-300">Semantic</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: List */}
                    <div className="lg:col-span-3">
                        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
                            <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                                <h2 className="text-sm font-bold text-slate-200">Indexed Knowledge Fragments</h2>
                                <button className="text-slate-500 hover:text-slate-300 transition">
                                    <RefreshCcw className="w-4 h-4" />
                                </button>
                            </div>

                            {isLoading ? (
                                <div className="p-20 flex flex-col items-center justify-center gap-4">
                                    <Cpu className="w-10 h-10 text-emerald-500/40 animate-pulse" />
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Accessing Semantic Clusters...</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {filteredItems.map(item => (
                                        <div key={item.id} className="group px-6 py-4 hover:bg-white/10 transition-all flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                                                item.type === 'story' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                                                item.type === 'api' ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                                                "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                            )}>
                                                {item.type === 'story' ? <Brain className="w-5 h-5" /> :
                                                item.type === 'api' ? <Database className="w-5 h-5" /> :
                                                <FileText className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-sm font-bold text-slate-200 truncate">{item.title}</h3>
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter",
                                                        item.projectKey === 'AUTH' ? "bg-blue-500/20 text-blue-400" :
                                                        item.projectKey === 'PAY' ? "bg-red-500/20 text-red-400" :
                                                        "bg-white/10 text-slate-400"
                                                    )}>
                                                        {item.projectKey}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                                                    <span className="flex items-center gap-1"><ExternalLink className="w-3 h-3" /> {item.source}</span>
                                                    <span>•</span>
                                                    <span>{item.timestamp}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-1.5">
                                                <div className={cn(
                                                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                                                    item.status === 'indexed' ? "bg-emerald-500/10 text-emerald-400" :
                                                    item.status === 'processing' ? "bg-amber-500/10 text-amber-400" :
                                                    "bg-red-500/10 text-red-400"
                                                )}>
                                                    {item.status === 'indexed' ? <CheckCircle2 className="w-3 h-3" /> :
                                                     item.status === 'processing' ? <RefreshCcw className="w-3 h-3 animate-spin" /> :
                                                     <AlertCircle className="w-3 h-3" />}
                                                    {item.status}
                                                </div>
                                                {item.chunks > 0 && <span className="text-[10px] text-slate-500 font-mono">{item.chunks} Chunks</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {filteredItems.length === 0 && !isLoading && (
                                <div className="p-20 text-center flex flex-col items-center gap-2">
                                    <Search className="w-10 h-10 text-slate-700" />
                                    <p className="text-sm text-slate-500">No knowledge fragments match your search.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
