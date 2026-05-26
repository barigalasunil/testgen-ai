import { EmbeddingService } from './embeddingService';
import { VectorStore, VectorMetadata } from './vectorStore';
import { MySqlService } from '../db/mysql.service';

/**
 * Service to ingest requirements and other artifacts into SQL and RAG.
 */
export class IngestionService {
    /**
     * Ingests a requirement (Jira story, PRD) into the system.
     */
    static async ingestRequirement(data: {
        jiraStoryId?: string;
        title: string;
        description: string;
        acceptanceCriteria: string;
        projectKey: string;
        businessContext?: string;
    }) {
        // 1. Store in MySQL for traceability
        const requirementId = await MySqlService.insert('requirements', {
            jira_story_id: data.jiraStoryId,
            title: data.title,
            description: data.description,
            acceptance_criteria: data.acceptanceCriteria,
            business_context: data.businessContext,
            project_key: data.projectKey,
            metadata: JSON.stringify({ ingestedAt: new Date().toISOString() })
        });

        // 2. Fragment and store in Vector Store for RAG
        const fullText = `
            Title: ${data.title}
            Description: ${data.description}
            Acceptance Criteria: ${data.acceptanceCriteria}
            Context: ${data.businessContext || ''}
        `.trim();

        const chunks = EmbeddingService.chunkText(fullText);
        
        for (let i = 0; i < chunks.length; i++) {
            const embedding = await EmbeddingService.generateEmbedding(chunks[i]);
            const metadata: VectorMetadata = {
                id: `${data.projectKey}-REQ-${requirementId}-CH-${i}`,
                projectKey: data.projectKey,
                type: 'story',
                jiraId: data.jiraStoryId,
                title: data.title,
                refId: requirementId
            };

            await VectorStore.addDocument(data.projectKey, chunks[i], embedding, metadata);
        }

        return requirementId;
    }

    /**
     * Ingests API collection for RAG.
     */
    static async ingestApiCollection(data: {
        name: string;
        sourceType: 'swagger' | 'curl' | 'postman' | 'raw';
        content: string;
        projectKey: string;
    }) {
        const collectionId = await MySqlService.insert('api_collections', {
            name: data.name,
            source_type: data.sourceType,
            content: data.content,
            project_key: data.projectKey
        });

        // Store API context in RAG
        const embedding = await EmbeddingService.generateEmbedding(data.content.slice(0, 5000));
        await VectorStore.addDocument(data.projectKey, data.content, embedding, {
            id: `API-${collectionId}`,
            projectKey: data.projectKey,
            type: 'api',
            title: data.name
        });

        return collectionId;
    }
}
