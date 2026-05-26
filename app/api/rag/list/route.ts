import { NextResponse } from 'next/server';
import { MySqlService } from '@/src/services/db/mysql.service';

/**
 * API route to list ingested knowledge fragments.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const projectKey = searchParams.get('projectKey');

        let sql = `
            SELECT 'requirement' as type, id, title, project_key, created_at, 'Jira/Manual' as source
            FROM requirements
            UNION ALL
            SELECT 'api' as type, id, name as title, project_key, created_at, source_type as source
            FROM api_collections
            ORDER BY created_at DESC
        `;
        
        let params: any[] = [];
        if (projectKey && projectKey !== 'All') {
            sql = `
                SELECT * FROM (${sql}) as combined
                WHERE project_key = ?
            `;
            params = [projectKey];
        }

        const results = await MySqlService.query(sql, params);

        return NextResponse.json({ success: true, items: results });
    } catch (error) {
        console.error('[RAG-LIST] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch memory items' }, { status: 500 });
    }
}
