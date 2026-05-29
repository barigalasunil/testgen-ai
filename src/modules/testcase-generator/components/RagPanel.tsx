"use client";

import { useEffect, useState } from 'react';
import { Search, RefreshCcw, Brain, Database, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type RagItem = {
  id: string;
  type: 'story' | 'api' | 'manual' | 'defect';
  title: string;
  projectKey: string;
  source: string;
  status: string;
  timestamp: string;
  chunks: number;
};

export function RagPanel() {
  const [items, setItems] = useState<RagItem[]>([]);
  const [selectedProject, setSelectedProject] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const projectKeys = ['All', 'TCGB', 'TCA', 'AUTH', 'PAY'];

  const fetchItems = async (projectKey = selectedProject) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ projectKey });
      const res = await fetch(`/api/rag/list?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items.map((item: any) => ({
          id: String(item.id),
          type: item.type,
          title: item.title,
          projectKey: item.project_key,
          source: item.source,
          status: 'indexed',
          timestamp: new Date(item.created_at).toLocaleString(),
          chunks: item.chunks || 1,
        })));
      }
    } catch (error) {
      console.error('RAG list fetch failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedProject]);

  const filteredItems = items.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.projectKey.toLowerCase().includes(query) ||
      item.source.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="border-b border-slate-200 px-4 py-4 bg-white/90">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 font-semibold mb-1">DeepMind RAG</p>
            <h2 className="text-lg font-semibold text-slate-900">Knowledge Search</h2>
          </div>
          <button
            onClick={() => fetchItems()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">Browse ingested requirements and project memory from the RAG store.</p>
      </div>

      <div className="px-4 py-3 bg-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stories, APIs, or projects"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Filter:</span>
            {projectKeys.map((key) => (
              <button
                key={key}
                onClick={() => setSelectedProject(key)}
                className={cn(
                  'rounded-full px-3 py-1 transition',
                  selectedProject === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                )}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-slate-500">Loading indexed content…</div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-10 text-center text-slate-500">
            No indexed knowledge found for this project.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                      {item.type === 'story' ? <Brain className="w-5 h-5" /> : item.type === 'api' ? <Database className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.projectKey} • {item.source}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">{item.chunks} chunks</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span>{item.timestamp}</span>
                  <span className="rounded-full border border-slate-200 px-2 py-1">{item.type}</span>
                  <span className="rounded-full border border-slate-200 px-2 py-1">{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
