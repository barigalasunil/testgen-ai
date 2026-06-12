const EMBEDDING_PATTERNS = [
    'embed',
    'bge',
    'nomic-embed',
    'all-minilm',
    'e5',
    'jina-embeddings',
    'jina-embed',
    'snowflake-arctic-embed',
    'mxbai-embed',
];

const CHAT_PATTERNS = [
    'qwen',
    'llama',
    'mistral',
    'gemma',
    'phi',
    'deepseek',
    'codellama',
    'stablelm',
    'tinyllama',
    'dolphin',
    'neural',
    'solar',
    'mixtral',
    'yi',
    'falcon',
    'command-r',
    'aya',
    'nous-hermes',
    'orca',
    'zephyr',
];

function isEmbeddingModel(modelName: string): boolean {
    const lower = modelName.toLowerCase();
    return EMBEDDING_PATTERNS.some(pattern => lower.startsWith(pattern) || lower.includes(pattern));
}

function isChatModel(modelName: string): boolean {
    if (isEmbeddingModel(modelName)) return false;
    const lower = modelName.toLowerCase();
    return CHAT_PATTERNS.some(pattern => lower.startsWith(pattern) || lower.includes(pattern));
}

export function filterChatModels(models: string[]): string[] {
    return models.filter(m => isChatModel(m));
}

export function filterEmbeddingModels(models: string[]): string[] {
    return models.filter(m => isEmbeddingModel(m));
}

export function splitModelsByType(models: string[]): { chatModels: string[]; embeddingModels: string[] } {
    const chatModels: string[] = [];
    const embeddingModels: string[] = [];
    for (const model of models) {
        if (isEmbeddingModel(model)) {
            embeddingModels.push(model);
        } else {
            chatModels.push(model);
        }
    }
    return { chatModels, embeddingModels };
}
