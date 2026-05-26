export type TraceEntityType = 'requirement' | 'testcase' | 'execution' | 'defect';

export type TraceabilityRecord = {
    id: string;
    type: TraceEntityType;
    label: string;
    jiraKey?: string;
    jiraUrl?: string;
    linkedIds: string[];
    createdAt: string;
    metadata?: Record<string, string>;
};

const STORAGE_KEY = 'tcgen-traceability';

function loadAll(): TraceabilityRecord[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as TraceabilityRecord[];
    } catch {
        return [];
    }
}

function saveAll(records: TraceabilityRecord[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function addRecord(record: Omit<TraceabilityRecord, 'createdAt'>): TraceabilityRecord {
    const full: TraceabilityRecord = { ...record, createdAt: new Date().toISOString() };
    const all = loadAll();
    all.push(full);
    saveAll(all);
    return full;
}

export function updateRecord(id: string, updates: Partial<TraceabilityRecord>): TraceabilityRecord | null {
    const all = loadAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    saveAll(all);
    return all[idx];
}

export function getByRequirement(requirementId: string): TraceabilityRecord[] {
    return loadAll().filter(r =>
        r.type === 'requirement' && r.id === requirementId
    );
}

export function getByTestCase(testCaseId: string): TraceabilityRecord[] {
    return loadAll().filter(r =>
        r.type === 'testcase' && r.id === testCaseId
    );
}

export function getByDefect(defectId: string): TraceabilityRecord[] {
    return loadAll().filter(r =>
        r.type === 'defect' && r.id === defectId
    );
}

export function getTraceabilityForRequirement(requirementId: string): {
    requirement: TraceabilityRecord | null;
    testCases: TraceabilityRecord[];
    executions: TraceabilityRecord[];
    defects: TraceabilityRecord[];
} {
    const all = loadAll();
    const requirement = all.find(r => r.type === 'requirement' && r.id === requirementId) || null;
    const linked = all.filter(r => r.linkedIds.includes(requirementId));
    return {
        requirement,
        testCases: linked.filter(r => r.type === 'testcase'),
        executions: linked.filter(r => r.type === 'execution'),
        defects: linked.filter(r => r.type === 'defect'),
    };
}

export function getAllRecords(): TraceabilityRecord[] {
    return loadAll();
}
