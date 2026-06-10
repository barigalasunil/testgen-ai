export type ApiInputMode = 'swagger-url' | 'swagger-upload' | 'curl' | 'raw' | 'postman' | 'jira';

export type ApiFramework = 'restassured' | 'playwright' | 'newman';

export type ApiTestCase = {
    testCaseId: string;
    apiScenario: string;
    method: string;
    endpoint: string;
    preconditions: string;
    requestData: string;
    steps: string;
    expectedStatusCode: string;
    expectedResult: string;
    testType: 'Positive' | 'Negative' | 'Boundary' | 'Auth' | 'Schema' | 'Error Handling' | 'Rate Limit' | 'Integration';
    priority: 'P1' | 'P2' | 'P3';
};

export type ApiExecutionResult = {
    status: 'idle' | 'running' | 'completed' | 'failed';
    durationMs?: number;
    passed: number;
    failed: number;
    total: number;
    logs: string[];
    reportUrl?: string;
    message?: string;
};
