import { MySqlService } from '../db/mysql.service';

/**
 * Service to handle project-scoped vector namespaces/collections.
 */
export class NamespaceService {
    /**
     * Generates a collection name for a project key.
     * Example: TCGB -> tcgen_rag_TCGB
     */
    static getCollectionName(projectKey: string): string {
        return `tcgen_rag_${projectKey.toUpperCase()}`;
    }

    /**
     * Verifies if a project exists and is valid.
     */
    static async validateProject(projectKey: string): Promise<boolean> {
        const results = await MySqlService.query(
            'SELECT project_key FROM projects WHERE project_key = ?',
            [projectKey]
        );
        return results.length > 0;
    }
}
