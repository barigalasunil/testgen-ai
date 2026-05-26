import { NextResponse } from 'next/server';
import { IngestionService } from '@/src/services/rag/ingestionService';

/**
 * API route for RAG knowledge ingestion.
 * Supports manual text and future file uploads.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, projectKey, title, content, metadata } = body;

        if (!projectKey || !content) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        console.log(`[RAG-INGEST] Ingesting ${type} for project ${projectKey}`);

        let id;
        if (type === 'requirement' || type === 'story') {
            id = await IngestionService.ingestRequirement({
                title,
                description: content,
                acceptanceCriteria: metadata?.acceptanceCriteria || '',
                projectKey,
                jiraStoryId: metadata?.jiraId,
            });
        } else if (type === 'api') {
            id = await IngestionService.ingestApiCollection({
                name: title,
                sourceType: metadata?.sourceType || 'raw',
                content,
                projectKey,
            });
        }

        return NextResponse.json({ 
            success: true, 
            id, 
            message: `${type} ingested successfully into Semantic Memory.` 
        });
    } catch (error) {
        console.error('[RAG-INGEST] Error:', error);
        return NextResponse.json({ success: false, error: 'Ingestion failed' }, { status: 500 });
    }
}
