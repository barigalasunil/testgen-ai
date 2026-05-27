import { MySqlService } from '../db/mysql.service';

export type TraceEntityType = 'requirement' | 'testcase' | 'execution' | 'defect';

export type TraceabilityRecord = {
    id: string | number;
    type: TraceEntityType;
    label: string;
    jiraKey?: string;
    jiraUrl?: string;
    linkedId?: string | number;
    projectKey: string;
    createdAt: string;
    metadata?: any;
};

/**
 * Traceability Service (Foundation for MySQL)
 */
export class TraceabilityService {
    /**
     * Records a traceability link in MySQL.
     */
    static async recordTrace(data: Omit<TraceabilityRecord, 'id' | 'createdAt'>) {
        const tableMap: Record<TraceEntityType, string> = {
            requirement: 'requirements',
            testcase: 'testcases',
            execution: 'executions',
            defect: 'defects'
        };

        // This is a foundation method that would interact with the specific tables
        // according to the enterprise schema created.
        console.log(`[TraceabilityService] Recording trace for ${data.type} in project ${data.projectKey}`);
        
        // Example: If it's a testcase, we might update or insert into 'testcases' table
        return true; 
    }

    /**
     * Retrieves full traceability for a requirement.
     */
    static async getTraceabilityChain(requirementId: number) {
        const requirement = await MySqlService.query('SELECT * FROM requirements WHERE id = ?', [requirementId]);
        const testCases = await MySqlService.query('SELECT * FROM testcases WHERE requirement_id = ?', [requirementId]);
        const defects = await MySqlService.query('SELECT * FROM defects WHERE requirement_id = ?', [requirementId]);
        
        return {
            requirement: requirement[0] || null,
            testCases,
            defects
        };
    }
}
