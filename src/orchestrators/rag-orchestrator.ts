export function buildCollectionName(projectKey: string): string {
    return `tcgen_rag_${projectKey.toUpperCase()}`;
}

export interface RAGContext {
    projectKey: string;
    collectionName: string;
    documentCount: number;
    lastIngested: string | null;
}

export function formatRAGContext(context: string, limit: number = 4000): string {
    if (!context) return '';
    return context.length > limit ? context.slice(0, limit) + '\n... (truncated)' : context;
}
