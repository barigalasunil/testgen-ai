import { AiProviderId } from "./providers/types";

export type TokenBudget = {
    maxContextTokens: number;
    maxOutputTokens: number;
    safeInputTokens: number;
    timeoutMs: number;
};

const DEFAULT_BUDGET: TokenBudget = {
    maxContextTokens: 8192,
    maxOutputTokens: 1800,
    safeInputTokens: 1800,
    timeoutMs: 90000,
};

const BUDGETS: Record<AiProviderId, TokenBudget> = {
    auto: DEFAULT_BUDGET,
    nvidia: { maxContextTokens: 8192, maxOutputTokens: 1800, safeInputTokens: 2200, timeoutMs: 90000 },
    openrouter: { maxContextTokens: 8192, maxOutputTokens: 1800, safeInputTokens: 2200, timeoutMs: 90000 },
    groq: { maxContextTokens: 8192, maxOutputTokens: 1400, safeInputTokens: 1800, timeoutMs: 75000 },
    opencode: { maxContextTokens: 8192, maxOutputTokens: 1600, safeInputTokens: 2000, timeoutMs: 90000 },
    ollama: {
        maxContextTokens: 4096,
        maxOutputTokens: 900,
        safeInputTokens: 900,
        timeoutMs: Number(process.env.OLLAMA_CHUNK_TIMEOUT_MS || process.env.OLLAMA_TIMEOUT_MS || 45000),
    },
};

export function estimateTokens(text: string) {
    return Math.ceil(text.length / 4);
}

export function getTokenBudget(provider: AiProviderId): TokenBudget {
    return BUDGETS[provider] || DEFAULT_BUDGET;
}

export function safeCharsForProvider(provider: AiProviderId) {
    return Math.max(1200, getTokenBudget(provider).safeInputTokens * 4);
}
