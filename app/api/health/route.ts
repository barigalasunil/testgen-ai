import { NextResponse } from "next/server";
import { aiProviderOrchestrator, AiProviderId, ProviderSettings } from "@/src/services/ai/provider-orchestrator";

const CACHE_TTL_MS = 60_000;

type CachedHealth = {
    status: Awaited<ReturnType<typeof aiProviderOrchestrator.checkStatus>>;
    timestamp: number;
    refreshing?: Promise<void>;
};

const healthCache = new Map<string, CachedHealth>();

function settingsFingerprint(provider: AiProviderId, settings?: ProviderSettings): string {
    if (!settings) return `${provider}:env`;
    return JSON.stringify({
        provider,
        nvidiaKey: Boolean(settings.nvidiaApiKey),
        nvidiaModel: settings.nvidiaModel || '',
        openrouterKey: Boolean(settings.openrouterApiKey),
        openrouterModel: settings.openrouterModel || '',
        groqKey: Boolean(settings.groqApiKey),
        groqModel: settings.groqModel || '',
        opencodeKey: Boolean(settings.opencodeApiKey),
        opencodeModel: settings.opencodeModel || '',
        ollamaBaseUrl: settings.ollamaBaseUrl || '',
        ollamaModel: settings.ollamaModel || '',
    });
}

async function refreshHealth(cacheKey: string, provider: AiProviderId, settings?: ProviderSettings) {
    const status = await Promise.race([
        aiProviderOrchestrator.checkStatus(provider, settings),
        new Promise<Awaited<ReturnType<typeof aiProviderOrchestrator.checkStatus>>>((resolve) => {
            setTimeout(() => resolve({
                connected: false,
                provider,
                status: 'offline',
                message: 'Health check timed out',
                checkedAt: Date.now(),
            }), 5000);
        }),
    ]);
    healthCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
}

async function getCachedHealth(provider: AiProviderId, settings?: ProviderSettings) {
    const cacheKey = settingsFingerprint(provider, settings);
    const cached = healthCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return { ...cached.status, cached: true, cacheAgeMs: now - cached.timestamp };
    }

    if (cached) {
        if (!cached.refreshing) {
            cached.refreshing = refreshHealth(cacheKey, provider, settings)
                .then(() => undefined)
                .catch(() => undefined);
            healthCache.set(cacheKey, cached);
        }
        return { ...cached.status, cached: true, stale: true, cacheAgeMs: now - cached.timestamp };
    }

    const status = await refreshHealth(cacheKey, provider, settings);
    return { ...status, cached: false, cacheAgeMs: 0 };
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({})) as {
            provider?: AiProviderId;
            providerSettings?: ProviderSettings;
        };
        const status = await getCachedHealth(body.provider || 'auto', body.providerSettings);
        return NextResponse.json(status);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            connected: false,
            status: 'offline',
            message,
            cached: false,
            checkedAt: Date.now(),
        });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const provider = (searchParams.get('provider') || 'auto') as AiProviderId;
    try {
        const status = await getCachedHealth(provider);
        return NextResponse.json(status);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            connected: false,
            status: 'offline',
            message,
            cached: false,
            checkedAt: Date.now(),
        });
    }
}
