import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url?.trim()) {
            return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
        }

        const res = await fetch(url.trim());
        if (!res.ok) {
            return NextResponse.json(
                { success: false, error: `Could not fetch spec (${res.status}). Check the URL.` },
                { status: 400 }
            );
        }

        const contentType = res.headers.get('content-type') || '';
        let spec: any;

        if (contentType.includes('yaml') || contentType.includes('text')) {
            const text = await res.text();
            // Basic YAML to JSON — extract key info without full parsing
            spec = { raw: text, format: 'yaml' };
        } else {
            spec = await res.json();
        }

        // Extract summary info for display
        const info = spec.info || {};
        const paths = spec.paths || {};
        const endpoints = Object.entries(paths).flatMap(([path, methods]: [string, any]) =>
            Object.keys(methods)
                .filter(m => ['get', 'post', 'put', 'delete', 'patch'].includes(m))
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
            endpoints: endpoints.slice(0, 20), // preview first 20
            rawSpec: JSON.stringify(spec, null, 2).slice(0, 8000),
        });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}