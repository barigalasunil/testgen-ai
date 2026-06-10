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

function fallbackEligible(error: AiProviderError): boolean {
    return [
        'RATE_LIMIT',
        'TOKEN_LIMIT',
        'QUOTA_EXCEEDED',
        'TIMEOUT',
        'NETWORK_ERROR',
        'INVALID_RESPONSE',
        'PROVIDER_ERROR',
        'MISSING_API_KEY',
        'MISSING_MODEL',
        'OLLAMA_OFFLINE',
    ].includes(error.code);
}

async function getOllamaModels(settings?: ProviderSettings): Promise<string[]> {
    const baseUrl = settings?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            throw new AiProviderError('ollama', 'OLLAMA_OFFLINE', `Ollama tags failed with HTTP ${response.status}`, response.status);
        }
        const data = await response.json() as { models?: { name: string }[] };
        return data.models?.map(model => model.name) || [];
    } catch (error) {
        if (error instanceof AiProviderError) throw error;
        throw new AiProviderError('ollama', 'OLLAMA_OFFLINE', 'Ollama is offline or unreachable');
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

    const models = await getOllamaModels(request.settings);
    if (models.length === 0) {
        throw new AiProviderError(provider, 'MISSING_MODEL', 'Ollama has no models installed');
    }
    const requested = model || request.settings?.ollamaModel || process.env.OLLAMA_MODEL;
    if (!requested || requested === 'auto') return models[0];
    if (models.includes(requested)) return requested;
    const prefixMatch = models.find(name => name.startsWith(requested.split(':')[0]));
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
        return await Promise.race([
            this.generateInternal(provider, request),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new AiProviderError('ollama', 'TIMEOUT', 'AI request timed out after 90 seconds')), 90000);
            }),
        ]);
    }

    private async generateInternal(provider: AiProviderId, request: ProviderGenerateRequest): Promise<ProviderOrchestratorResult & { attempts: ProviderAttempt[] }> {
        const attempts: ProviderAttempt[] = [];
        const chain = provider === 'auto' ? FALLBACK_CHAIN : [provider as RuntimeProviderId];

        console.log(`[AI] Selected provider: ${PROVIDER_LABELS[provider]}`);

        for (const candidate of chain) {
            const requestedModel = modelFor(
                candidate,
                request.settings,
                provider === 'auto' ? undefined : request.model
            );

            try {
                const resolvedModel = await preflightProvider(candidate, request, requestedModel);
                console.log(`[AI] Trying provider: ${PROVIDER_LABELS[candidate]}`);
                const result = await executeProvider(candidate, request, resolvedModel);
                attempts.push({ provider: candidate, model: result.modelUsed, status: 'success' });
                console.log(`[AI] ${PROVIDER_LABELS[candidate]} success`);
                return {
                    content: result.content,
                    providerUsed: result.providerUsed,
                    modelUsed: result.modelUsed,
                    fallbackUsed: provider === 'auto' && candidate !== FALLBACK_CHAIN[0],
                    fallbackChain: provider === 'auto' ? attempts.map((attempt) => attempt.provider) : undefined,
                    attempts,
                };
            } catch (error) {
                const normalized = normalizeUnknownError(candidate, error);
                const status = normalized.code === 'MISSING_API_KEY' || normalized.code === 'MISSING_MODEL'
                    ? 'skipped'
                    : 'failed';
                attempts.push({
                    provider: candidate,
                    model: requestedModel || 'auto',
                    status,
                    code: normalized.code,
                    reason: normalized.message,
                });
                console.warn(`[AI] ${PROVIDER_LABELS[candidate]} ${status}: ${normalized.code}`);

                if (provider !== 'auto' || !fallbackEligible(normalized)) {
                    throw Object.assign(normalized, { attempts });
                }
            }
        }

        const summary = attempts.map((attempt) => `${PROVIDER_LABELS[attempt.provider]}: ${attempt.reason || attempt.status}`).join('; ');
        const error = new AiProviderError('ollama', 'PROVIDER_ERROR', `All AI providers failed. ${summary}`);
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
            return {
                connected: response.ok,
                provider,
                providerUsed: runtimeProvider,
                model: model || 'mistral:7b',
                status: response.ok ? 'connected' : 'offline',
                message: response.ok ? 'Ollama Local Connected' : 'Ollama Local Offline',
                checkedAt,
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
            };
        }
    }
}

export const aiProviderOrchestrator = new AiProviderOrchestrator();
export type { AiProviderId, ProviderSettings, RuntimeProviderId };
