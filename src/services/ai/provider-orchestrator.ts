import { generateWithGroq } from './providers/groq.provider';
import { generateWithNvidia } from './providers/nvidia.provider';
import { generateWithOllama } from './providers/ollama.provider';
import { generateWithOpenCode } from './providers/opencode.provider';
import { generateWithOpenRouter } from './providers/openrouter.provider';
import {
    AiProviderError,
    AiProviderId,
    ProviderGenerateRequest,
    ProviderSettings,
    RuntimeProviderId,
} from './providers/types';
import { getErrorMessage, normalizeUnknownError } from './providers/shared';
import { filterChatModels, filterEmbeddingModels, splitModelsByType } from './providers/ollama-utils';

export type ProviderOrchestratorResult = {
    content: string;
    providerUsed: RuntimeProviderId;
    modelUsed: string;
    fallbackUsed: boolean;
    fallbackChain?: string[];
    error?: string;
};

export type ProviderAttempt = {
    provider: RuntimeProviderId;
    model: string;
    status: 'success' | 'failed' | 'skipped';
    code?: string;
    reason?: string;
};

export type ProviderStatusResult = {
    connected: boolean;
    provider: AiProviderId;
    providerUsed?: RuntimeProviderId;
    model?: string;
    status: 'connected' | 'offline' | 'fallback' | 'inactive';
    message: string;
    checkedAt?: number;
    chatModels?: string[];
    embeddingModels?: string[];
};

const FALLBACK_CHAIN: RuntimeProviderId[] = ['nvidia', 'openrouter', 'groq', 'opencode', 'ollama'];

const PROVIDER_LABELS: Record<AiProviderId, string> = {
    auto: 'Auto',
    nvidia: 'NVIDIA',
    openrouter: 'OpenRouter',
    groq: 'Groq',
    opencode: 'OpenCode',
    ollama: 'Ollama Local',
};

function modelFor(provider: RuntimeProviderId, settings?: ProviderSettings, explicitModel?: string): string | undefined {
    if (explicitModel && explicitModel !== 'auto') return explicitModel;
    if (provider === 'nvidia') return settings?.nvidiaModel || process.env.NVIDIA_MODEL || process.env.NVIDIA_OPENAI_MODEL;
    if (provider === 'openrouter') return settings?.openrouterModel || process.env.OPENROUTER_MODEL;
    if (provider === 'groq') return settings?.groqModel || process.env.GROQ_MODEL;
    if (provider === 'opencode') return settings?.opencodeModel || process.env.OPENCODE_MODEL;
    return settings?.ollamaModel || process.env.OLLAMA_MODEL;
}

function modelConfigured(provider: RuntimeProviderId, settings?: ProviderSettings): boolean {
    return Boolean(modelFor(provider, settings));
}

function hasConfig(provider: RuntimeProviderId, settings?: ProviderSettings): boolean {
    if (provider === 'nvidia') return Boolean(settings?.nvidiaApiKey || process.env.NVIDIA_API_KEY || process.env.NVIDIA_OPENAI_API_KEY);
    if (provider === 'openrouter') return Boolean(settings?.openrouterApiKey || process.env.OPENROUTER_API_KEY);
    if (provider === 'groq') return Boolean(settings?.groqApiKey || process.env.GROQ_API_KEY);
    if (provider === 'opencode') return Boolean(settings?.opencodeApiKey || process.env.OPENCODE_API_KEY);
    return Boolean(settings?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434');
}

function getOllamaTimeout(): number {
    const env = process.env.OLLAMA_TIMEOUT_MS;
    if (env) {
        const parsed = parseInt(env, 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 60000;
}

function fallbackEligible(error: AiProviderError): boolean {
    return [
        'RATE_LIMIT',
        'TOKEN_LIMIT',
        'QUOTA_EXCEEDED',
        'TIMEOUT',
        'MODEL_TIMEOUT',
        'NETWORK_ERROR',
        'INVALID_RESPONSE',
        'PROVIDER_ERROR',
        'MISSING_API_KEY',
        'MISSING_MODEL',
        'OLLAMA_OFFLINE',
    ].includes(error.code);
}

async function getOllamaModels(settings?: ProviderSettings): Promise<{ chatModels: string[]; embeddingModels: string[] }> {
    const baseUrl = settings?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, {
            signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
            return { chatModels: [], embeddingModels: [] };
        }
        const data = await response.json() as { models?: { name: string }[] };
        const allModels = data.models?.map(model => model.name) || [];
        return splitModelsByType(allModels);
    } catch {
        return { chatModels: [], embeddingModels: [] };
    }
}

async function preflightProvider(provider: RuntimeProviderId, request: ProviderGenerateRequest, model: string | undefined): Promise<string> {
    if (provider !== 'ollama') {
        if (!hasConfig(provider, request.settings)) {
            throw new AiProviderError(provider, 'MISSING_API_KEY', `${PROVIDER_LABELS[provider]} API key missing`);
        }
        if (!model) {
            throw new AiProviderError(provider, 'MISSING_MODEL', `${PROVIDER_LABELS[provider]} model missing`);
        }
        return model;
    }

    const { chatModels } = await getOllamaModels(request.settings);
    if (chatModels.length === 0) {
        throw new AiProviderError(provider, 'MISSING_MODEL', 'Ollama has no chat models installed');
    }
    const requested = model || request.settings?.ollamaModel || process.env.OLLAMA_MODEL;
    if (!requested || requested === 'auto') return chatModels[0];
    if (chatModels.includes(requested)) return requested;
    const prefixMatch = chatModels.find(name => name.startsWith(requested.split(':')[0]));
    if (prefixMatch) return prefixMatch;
    throw new AiProviderError(provider, 'MISSING_MODEL', `Ollama model "${requested}" is not installed`);
}

async function executeProvider(provider: RuntimeProviderId, request: ProviderGenerateRequest, model: string) {
    const nextRequest = { ...request, model };
    if (provider === 'nvidia') return generateWithNvidia(nextRequest);
    if (provider === 'openrouter') return generateWithOpenRouter(nextRequest);
    if (provider === 'groq') return generateWithGroq(nextRequest);
    if (provider === 'opencode') return generateWithOpenCode(nextRequest);
    return generateWithOllama(nextRequest);
}

export class AiProviderOrchestrator {
    getProviderLabel(provider: AiProviderId): string {
        return PROVIDER_LABELS[provider];
    }

    getFallbackChain(): RuntimeProviderId[] {
        return FALLBACK_CHAIN;
    }

    async generate(provider: AiProviderId, request: ProviderGenerateRequest): Promise<ProviderOrchestratorResult & { attempts: ProviderAttempt[] }> {
        // Global safety timeout of 120 seconds
        return await Promise.race([
            this.generateInternal(provider, request),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new AiProviderError('ollama', 'TIMEOUT', 'Global AI request timed out after 120 seconds')), 120000);
            }),
        ]);
    }

    private async generateInternal(provider: AiProviderId, request: ProviderGenerateRequest): Promise<ProviderOrchestratorResult & { attempts: ProviderAttempt[] }> {
        const attempts: ProviderAttempt[] = [];
        const chain = provider === 'auto' ? FALLBACK_CHAIN : [provider as RuntimeProviderId];
        
        // Define fallback models for cloud providers for model-level resilience
        const modelChain: Record<string, string[]> = {
            nvidia: ['meta/llama-3.1-405b-instruct', 'meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct'],
            openrouter: ['meta-llama/llama-3.1-405b-instruct', 'google/gemini-pro-1.5', 'openai/gpt-4o-mini'],
            groq: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant'],
            opencode: ['meta-llama/llama-3.1-405b-instruct', 'meta-llama/llama-3.1-70b-instruct'],
        };

        // Build Ollama model chain from only installed chat models — never hardcoded, never embedding
        function buildOllamaModelChain(primaryModel: string | undefined, chatModels: string[]): string[] {
            if (chatModels.length === 0) return [];
            if (!primaryModel || primaryModel === 'auto') return [...chatModels];
            // Exact match goes first
            if (chatModels.includes(primaryModel)) {
                return [primaryModel, ...chatModels.filter(m => m !== primaryModel)];
            }
            // Prefix match
            const prefix = primaryModel.split(':')[0];
            const prefixMatch = chatModels.find(m => m.startsWith(prefix));
            if (prefixMatch) {
                return [prefixMatch, ...chatModels.filter(m => m !== prefixMatch)];
            }
            // Primary not installed — use all installed chat models in API order
            return [...chatModels];
        }

        console.log(`[AI] Dispatching request with ${PROVIDER_LABELS[provider]} strategy`);

        for (const candidate of chain) {
            // For Ollama, dynamically build model chain from installed chat models only
            if (candidate === 'ollama') {
                const { chatModels, embeddingModels } = await getOllamaModels(request.settings);
                if (chatModels.length === 0) {
                    attempts.push({
                        provider: candidate,
                        model: request.model || 'unknown',
                        status: 'skipped',
                        code: 'OLLAMA_OFFLINE',
                        reason: embeddingModels.length > 0
                            ? 'Ollama has no chat models installed (only embedding models)'
                            : 'Ollama is offline or has no models installed',
                    });
                    if (provider !== 'auto') break;
                    continue;
                }

                const primaryModel = modelFor(
                    candidate,
                    request.settings,
                    provider === 'auto' ? 'auto' : request.model
                );

                const modelsToTry = buildOllamaModelChain(primaryModel, chatModels);
                const ollamaTimeout = getOllamaTimeout();
                const attemptedModels = new Set<string>();

                for (const currentModel of modelsToTry) {
                    if (attemptedModels.has(currentModel)) continue;
                    attemptedModels.add(currentModel);

                    try {
                        const resolvedModel = await preflightProvider(candidate, request, currentModel);
                        console.log(`[AI] Attempting ${PROVIDER_LABELS[candidate]} (Model: ${resolvedModel})`);

                        const result = await Promise.race([
                            executeProvider(candidate, request, resolvedModel),
                            new Promise<never>((_, reject) => {
                                setTimeout(() => reject(new AiProviderError(candidate, 'MODEL_TIMEOUT', `${PROVIDER_LABELS[candidate]} (${resolvedModel}) timed out after ${ollamaTimeout/1000}s`)), ollamaTimeout);
                            }),
                        ]);

                        attempts.push({ provider: candidate, model: result.modelUsed, status: 'success' });
                        return {
                            content: result.content,
                            providerUsed: result.providerUsed,
                            modelUsed: result.modelUsed,
                            fallbackUsed: attempts.length > 1,
                            fallbackChain: attempts.map((attempt) => attempt.provider),
                            attempts,
                        };
                    } catch (error) {
                        const normalized = normalizeUnknownError(candidate, error);
                        // Use MODEL_TIMEOUT for generation timeouts, never OLLAMA_OFFLINE
                        const errorCode = normalized.code === 'TIMEOUT' || normalized.code === 'OLLAMA_OFFLINE'
                            ? 'MODEL_TIMEOUT'
                            : normalized.code;

                        const status = errorCode === 'MISSING_API_KEY' || errorCode === 'MISSING_MODEL' ? 'skipped' : 'failed';
                        attempts.push({
                            provider: candidate,
                            model: currentModel,
                            status,
                            code: errorCode,
                            reason: normalized.message,
                        });

                        if (errorCode === 'MODEL_TIMEOUT') {
                            console.warn(`[AI] ${PROVIDER_LABELS[candidate]} (${currentModel}) timed out, trying next model`);
                        } else {
                            console.warn(`[AI] ${PROVIDER_LABELS[candidate]} (${currentModel}) ${status}: ${errorCode}`);
                        }
                    }
                }

                if (provider !== 'auto') break;
                continue;
            }

            // For cloud providers, use the existing model chain
            const primaryModel = modelFor(
                candidate,
                request.settings,
                provider === 'auto' ? 'auto' : request.model
            );
            
            const modelsToTry = (primaryModel === 'auto' || !primaryModel)
                ? (modelChain[candidate] || ['auto'])
                : [primaryModel, ...(modelChain[candidate] || []).filter(m => m !== primaryModel)];

            for (const currentModel of modelsToTry) {
                try {
                    const resolvedModel = await preflightProvider(candidate, request, currentModel);
                    console.log(`[AI] Attempting ${PROVIDER_LABELS[candidate]} (Model: ${resolvedModel})`);

                    const timeout = 90000;

                    const result = await Promise.race([
                        executeProvider(candidate, request, resolvedModel),
                        new Promise<never>((_, reject) => {
                            setTimeout(() => reject(new AiProviderError(candidate, 'TIMEOUT', `${PROVIDER_LABELS[candidate]} request timed out after ${timeout/1000}s`)), timeout);
                        }),
                    ]);

                    attempts.push({ provider: candidate, model: result.modelUsed, status: 'success' });
                    return {
                        content: result.content,
                        providerUsed: result.providerUsed,
                        modelUsed: result.modelUsed,
                        fallbackUsed: attempts.length > 1,
                        fallbackChain: attempts.map((attempt) => attempt.provider),
                        attempts,
                    };
                } catch (error) {
                    const normalized = normalizeUnknownError(candidate, error);
                    const status = normalized.code === 'MISSING_API_KEY' || normalized.code === 'MISSING_MODEL' ? 'skipped' : 'failed';
                    attempts.push({
                        provider: candidate,
                        model: currentModel,
                        status,
                        code: normalized.code,
                        reason: normalized.message,
                    });
                    console.warn(`[AI] ${PROVIDER_LABELS[candidate]} (${currentModel}) ${status}: ${normalized.code}`);
                    break;
                }
            }

            // Special case: If Ollama failed and it was the primary, and OpenRouter is in the chain, it's already handled by the outer loop
            if (provider !== 'auto') {
                // If we are NOT in auto mode, we only tried one provider. If it failed all its models, we throw.
                break; 
            }
        }

        const ollamaAttempts = attempts.filter(a => a.provider === 'ollama' && a.status === 'failed');
        const ollamaSkipped = attempts.filter(a => a.provider === 'ollama' && a.status === 'skipped');
        if (ollamaAttempts.length > 0) {
            const chatFailures = ollamaAttempts.map(a => `- ${a.model} ${a.reason?.toLowerCase().includes('timeout') ? 'timed out' : 'failed'}`).join('\n');
            const skippedEmbeddings = ollamaSkipped.filter(a => a.code === 'MISSING_MODEL').map(a => `- ${a.model}`).join('\n');
            let msg = `Ollama generation failed for chat models:\n${chatFailures}`;
            if (skippedEmbeddings) {
                msg += `\n\nSkipped embedding models:\n${skippedEmbeddings}`;
            }
            const error = new AiProviderError('auto', 'PROVIDER_ERROR', msg);
            throw Object.assign(error, { attempts });
        }

        const summary = attempts.map((attempt) => `${PROVIDER_LABELS[attempt.provider]} (${attempt.model}): ${attempt.reason || attempt.status}`).join(' | ');
        const error = new AiProviderError('auto', 'PROVIDER_ERROR', `AI generation failed across all attempts. Details: ${summary}`);
        throw Object.assign(error, { attempts });
    }

    async checkStatus(provider: AiProviderId, settings?: ProviderSettings): Promise<ProviderStatusResult> {
        const checkedAt = Date.now();
        if (provider === 'auto') {
            for (const candidate of FALLBACK_CHAIN) {
                if (candidate !== 'ollama' && !hasConfig(candidate, settings)) continue;
                const status = await this.checkStatus(candidate, settings);
                if (status.connected) {
                    return {
                        connected: true,
                        provider,
                        providerUsed: candidate,
                        model: status.model,
                        status: candidate === FALLBACK_CHAIN[0] ? 'connected' : 'fallback',
                        message: candidate === FALLBACK_CHAIN[0]
                            ? `Auto Fallback - ${PROVIDER_LABELS[candidate]} Connected`
                            : `Auto Fallback - using ${PROVIDER_LABELS[candidate]}`,
                        checkedAt,
                    };
                }
            }
            return { connected: false, provider, status: 'offline', message: 'Auto Fallback - all providers offline', checkedAt };
        }

        const runtimeProvider = provider as RuntimeProviderId;
        try {
            const model = modelFor(runtimeProvider, settings);
            if (runtimeProvider !== 'ollama') {
                if (!hasConfig(runtimeProvider, settings)) {
                    return { connected: false, provider, status: 'offline', model, message: `${PROVIDER_LABELS[provider]} API key missing`, checkedAt };
                }
                if (!modelConfigured(runtimeProvider, settings)) {
                    return { connected: false, provider, status: 'offline', model, message: `${PROVIDER_LABELS[provider]} model missing`, checkedAt };
                }
                return {
                    connected: true,
                    provider,
                    providerUsed: runtimeProvider,
                    model,
                    status: 'connected',
                    message: `${PROVIDER_LABELS[provider]} Connected`,
                    checkedAt,
                };
            }

            const baseUrl = settings?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
            const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(3000) });
            if (response.ok) {
                const data = await response.json() as { models?: { name: string }[] };
                const allModels = data.models?.map(m => m.name) || [];
                const { chatModels, embeddingModels } = splitModelsByType(allModels);
                const resolvedModel = model && chatModels.includes(model) ? model : (chatModels[0] || '');
                return {
                    connected: true,
                    provider,
                    providerUsed: runtimeProvider,
                    model: resolvedModel,
                    status: 'connected',
                    message: chatModels.length > 0
                        ? `Ollama Local Connected (${chatModels.length} chat model${chatModels.length !== 1 ? 's' : ''})`
                        : embeddingModels.length > 0
                            ? 'Ollama Local (only embedding models)'
                            : 'Ollama Local Connected',
                    checkedAt,
                    chatModels,
                    embeddingModels,
                };
            }
            return {
                connected: false,
                provider,
                providerUsed: runtimeProvider,
                model: model || '',
                status: 'offline',
                message: 'Ollama Local Offline',
                checkedAt,
                chatModels: [],
                embeddingModels: [],
            };
        } catch (error) {
            return {
                connected: false,
                provider,
                providerUsed: runtimeProvider,
                model: modelFor(runtimeProvider, settings),
                status: 'offline',
                message: getErrorMessage(error),
                checkedAt,
                chatModels: [],
                embeddingModels: [],
            };
        }
    }
}

export const aiProviderOrchestrator = new AiProviderOrchestrator();
export type { AiProviderId, ProviderSettings, RuntimeProviderId };
