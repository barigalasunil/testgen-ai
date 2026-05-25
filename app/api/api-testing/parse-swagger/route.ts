import { NextResponse } from 'next/server';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';
type OpenApiOperation = {
    summary?: string;
    operationId?: string;
};
type OpenApiSpec = {
    info?: {
        title?: string;
        version?: string;
        description?: string;
    };
    paths?: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
    raw?: string;
    format?: 'yaml';
};

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch'];

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url?.trim()) {
            return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
        }

        // Handle local public files.
        const trimmedUrl = url.trim();
        const isLocal = trimmedUrl.startsWith('/');
        const fetchUrl = isLocal
            ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${trimmedUrl}`
            : trimmedUrl;

        const res = await fetch(fetchUrl);
        if (!res.ok) {
            return NextResponse.json(
                { success: false, error: `Could not fetch spec (${res.status}). Check the URL.` },
                { status: 400 }
            );
        }

        const contentType = res.headers.get('content-type') || '';
        let spec: OpenApiSpec;

        if (contentType.includes('yaml') || (contentType.includes('text') && !contentType.includes('json'))) {
            const text = await res.text();
            spec = { raw: text, format: 'yaml' };
        } else {
            spec = await res.json();
        }

        const info = spec.info || {};
        const paths = spec.paths || {};
        const endpoints = Object.entries(paths).flatMap(([path, methods]) =>
            HTTP_METHODS
                .filter(method => methods[method])
                .map(method => ({
                    method: method.toUpperCase(),
                    path,
                    summary: methods[method]?.summary || '',
                    operationId: methods[method]?.operationId || '',
                }))
        );

        return NextResponse.json({
            success: true,
            title: info.title || 'API',
            version: info.version || '',
            description: info.description || '',
            endpointCount: endpoints.length,
            endpoints: endpoints.slice(0, 20),
            rawSpec: JSON.stringify(spec, null, 2).slice(0, 8000),
        });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
