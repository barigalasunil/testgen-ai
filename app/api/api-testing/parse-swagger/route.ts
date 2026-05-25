import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url?.trim()) {
            return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
        }

        let spec: any;

        // Handle local public files — read from disk directly
        if (url.startsWith('/')) {
            try {
                const filePath = join(process.cwd(), 'public', url);
                const raw = readFileSync(filePath, 'utf-8');
                spec = JSON.parse(raw);
            } catch (err) {
                return NextResponse.json(
                    { success: false, error: `Could not read local spec file: ${url}. Make sure it exists in the public/ folder.` },
                    { status: 400 }
                );
            }
        } else {
            // External URL — fetch normally
            try {
                const res = await fetch(url.trim());
                if (!res.ok) {
                    return NextResponse.json(
                        { success: false, error: `Could not fetch spec (${res.status}). Check the URL.` },
                        { status: 400 }
                    );
                }
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('yaml') || (contentType.includes('text') && !contentType.includes('json'))) {
                    const text = await res.text();
                    spec = { raw: text, format: 'yaml' };
                } else {
                    spec = await res.json();
                }
            } catch (err) {
                return NextResponse.json(
                    { success: false, error: `Failed to fetch: ${err instanceof Error ? err.message : String(err)}` },
                    { status: 400 }
                );
            }
        }

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
            endpoints: endpoints.slice(0, 20),
            rawSpec: JSON.stringify(spec, null, 2).slice(0, 8000),
        });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}