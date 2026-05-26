import { EmbeddingService } from './embeddingService';
import { VectorStore, SearchResult } from './vectorStore';

/**
 * Service to retrieve relevant context for AI generation.
 */
export class RetrievalService {
    /**
     * Retrieves historical context for a specific project.
     * This ensures the AI only sees data relevant to the active project key.
     */
    static async getProjectContext(
        projectKey: string,
        query: string,
        limit: number = 5
    ): Promise<string> {
        console.log(`[RetrievalService] Retrieving context for project: ${projectKey}`);
        
        const queryEmbedding = await EmbeddingService.generateEmbedding(query);
        
        // Search ONLY within the project's collection
        const results = await VectorStore.similaritySearch(projectKey, queryEmbedding, limit);
        
        if (results.length === 0) {
            return "No historical context found for this project.";
        }

        return results.map(r => 
            `[Source: ${r.metadata.type} ${r.metadata.jiraId || ''}] ${r.content}`
        ).join('\n\n---\n\n');
    }

    /**
     * Specifically retrieves similar test cases for learning project patterns.
     */
    static async getSimilarTestCases(projectKey: string, storyTitle: string): Promise<SearchResult[]> {
        const queryEmbedding = await EmbeddingService.generateEmbedding(storyTitle);
        // Filter search logic would go here
        return await VectorStore.similaritySearch(projectKey, queryEmbedding, 3);
    }
}
